import { db } from "@/lib/db";
import { CreateTenantSchema } from "@/lib/validations/tenant";
import { isReservedSlug, slugCandidate, slugify } from "@/lib/onboarding";

/** Bounded retry so a pathological run of slug collisions can't loop forever. */
const MAX_SLUG_ATTEMPTS = 25;
/** Leave room for a "-N" collision suffix under SlugSchema's 50-char cap. */
const MAX_BASE_SLUG_LENGTH = 40;

/**
 * The authenticated identity of the person creating a workspace. The server
 * action reads this from Clerk (`currentUser()`) and passes it in, so this
 * service stays free of request-context I/O and can be tested against a real DB.
 */
export interface WorkspaceOwner {
    userId: string;
    email: string;
    firstName: string;
    lastName: string | null;
}

export interface CreateWorkspaceInput {
    name: string;
    /** Optional user-edited slug; falls back to one derived from the name. */
    slug?: string;
}

export type CreateWorkspaceResult =
    | { ok: true; slug: string }
    | { ok: false; error: string };

/**
 * Is this slug free to claim? Normalizes first, rejects reserved/empty names,
 * then checks the DB. Used by the onboarding form's live availability check.
 */
export async function isSlugAvailable(
    rawSlug: string
): Promise<{ slug: string; available: boolean }> {
    const slug = slugify(rawSlug);
    if (!slug || isReservedSlug(slug)) {
        return { slug, available: false };
    }
    const existing = await db.tenant.findUnique({ where: { slug } });
    return { slug, available: !existing };
}

/**
 * Provision a brand-new workspace for `owner` and make them its ADMIN/owner.
 * This is the self-serve counterpart to the superadmin invite flow
 * (createUserForTenant) — but it does NOT create a Clerk account (the user
 * already signed up through Clerk's hosted UI); it only writes the DB rows for
 * their existing Clerk id.
 *
 * Invariant: a self-serve signup ALWAYS creates its own new tenant and never
 * joins an existing one. Teammates keep arriving via the invite flow.
 */
export async function createWorkspace(
    owner: WorkspaceOwner,
    input: CreateWorkspaceInput
): Promise<CreateWorkspaceResult> {
    // 1. Idempotency: if this user already owns a workspace, don't create a
    //    second one — send them back to it. Guards double-submit / refresh.
    const existing = await db.user.findUnique({
        where: { id: owner.userId },
        include: { tenant: true },
    });
    if (existing?.isSuperAdmin) {
        return { ok: false, error: "Superadmins cannot create a self-serve workspace." };
    }
    if (existing?.tenant) {
        return { ok: true, slug: existing.tenant.slug };
    }

    // 2. Validate input. Name is what the user types; slug is derived (locked
    //    decision 4) and plan is forced to FREE (M5 seam — no billing here).
    const name = input.name.trim();
    const parsed = CreateTenantSchema.safeParse({
        name,
        slug: slugify(input.slug || name) || "workspace",
        plan: "FREE",
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid company name.",
        };
    }

    const base =
        (slugify(input.slug || parsed.data.name) || "workspace").slice(
            0,
            MAX_BASE_SLUG_LENGTH
        ) || "workspace";

    // 3. Create tenant + owner user atomically, retrying the WHOLE transaction
    //    on a slug collision (a pre-check alone races the write).
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
        const slug = slugCandidate(base, attempt);
        if (isReservedSlug(slug)) {
            continue; // reserved name → skip to the next suffix
        }

        try {
            const tenant = await db.$transaction(async (tx) => {
                const created = await tx.tenant.create({
                    data: {
                        name: parsed.data.name,
                        slug,
                        plan: "FREE",
                        // TODO(billing): assign trial/plan on signup once Razorpay lands.
                    },
                });

                // upsert by Clerk id: creates the row for a fresh signup, or
                // attaches the tenant to a rare tenant-less row. Owner = ADMIN.
                await tx.user.upsert({
                    where: { id: owner.userId },
                    create: {
                        id: owner.userId,
                        email: owner.email,
                        firstName: owner.firstName,
                        lastName: owner.lastName,
                        role: "ADMIN",
                        tenantId: created.id,
                    },
                    update: {
                        role: "ADMIN",
                        tenantId: created.id,
                    },
                });

                return created;
            });

            return { ok: true, slug: tenant.slug };
        } catch (err) {
            // A P2002 here means the slug collided: slug is the only unique on
            // tenant, and the new user's (email, tenantId) can't clash with a
            // brand-new tenantId. `instanceof` is unreliable across module realms,
            // so match on the code — same approach as notification-service.
            if ((err as { code?: unknown } | null | undefined)?.code === "P2002") {
                continue;
            }
            throw err;
        }
    }

    return {
        ok: false,
        error:
            "Could not find an available workspace address. Please try a different company name.",
    };
}
