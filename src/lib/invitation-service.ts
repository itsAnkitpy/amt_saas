import { db } from "@/lib/db";
import type { Invitation, Role } from "@/generated/prisma";

// The shared engine behind teammate invites (PRD 12). One place holds the real
// work — "create a membership in tenant X with role Y" — and both doors (the
// client's own invite form and the superadmin panel) call it, so they can't
// drift apart. No request-context I/O: the caller's identity is passed in, so
// every function is testable against a real DB.
//
// Clerk delivers the email and gates sign-up to the invited address (D5), but
// our Invitation table stays the source of truth (D2). The Clerk call is hidden
// behind InvitationTransport so tests inject a fake and never hit the network,
// and it is loaded via a lazy import() so this module carries no top-level
// server-only import (stays node-testable and off any client bundle).

/** How long a fresh invite stays claimable. Kept in sync with the Clerk invite. */
export const INVITE_EXPIRY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The email side of an invite. The default implementation talks to Clerk; tests
 * pass a fake. `send` returns the Clerk invitation id we store for revoke.
 */
export interface InvitationTransport {
    send(params: {
        email: string;
        tenantId: string;
        tenantName: string;
        role: Role;
        expiresInDays: number;
    }): Promise<{ id: string }>;
    revoke(clerkInvitationId: string): Promise<void>;
}

/** "ADMIN" -> "Admin", for the invite email copy. */
function roleLabel(role: Role): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
}

/**
 * Default transport: Clerk creates the invite + one-time ticket but does NOT
 * email it (notify:false); we send our OWN email through the app's transport
 * (Mailpit locally, Resend in prod), so it is catchable in local dev and
 * brandable (D5 hybrid). Everything is loaded lazily so this module stays free
 * of top-level server-only imports (node-testable, off the client bundle).
 */
const clerkTransport: InvitationTransport = {
    async send({ email, tenantId, tenantName, role, expiresInDays }) {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const { sendEmail } = await import("@/lib/email");
        const { inviteEmail } = await import("@/emails/teammate-invite");

        const clerk = await clerkClient();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

        const invite = await clerk.invitations.createInvitation({
            emailAddress: email,
            redirectUrl: `${appUrl}/sign-up`,
            expiresInDays,
            notify: false, // we deliver the email ourselves (below)
            ignoreExisting: true,
            // Copied to the user on accept — lets claim-at-login pick the right
            // workspace when one email holds invites to more than one (M3/M6).
            publicMetadata: { tenantId },
        });

        if (!invite.url) {
            // No accept link means we can't email a usable invite — roll back.
            await clerk.invitations.revokeInvitation(invite.id).catch(() => {});
            throw new Error("Clerk did not return an invitation link.");
        }

        try {
            await sendEmail({
                to: email,
                subject: `You're invited to join ${tenantName}`,
                react: inviteEmail({
                    tenantName,
                    acceptUrl: invite.url,
                    roleLabel: roleLabel(role),
                    expiresInDays,
                    recipientEmail: email,
                }),
            });
        } catch (err) {
            // Don't strand a live Clerk invite with no email out — roll it back.
            await clerk.invitations.revokeInvitation(invite.id).catch(() => {});
            throw err;
        }

        return { id: invite.id };
    },
    async revoke(clerkInvitationId) {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const clerk = await clerkClient();
        await clerk.invitations.revokeInvitation(clerkInvitationId);
    },
};

export interface InviteToTenantInput {
    tenantId: string;
    email: string;
    role: Role;
    /** The inviter's user id — stored for audit, never trusted for scope. */
    invitedById: string;
}

export type InviteResult =
    | { ok: true; invitation: Invitation }
    | { ok: false; error: string };

export interface ClaimInput {
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    /**
     * Optional tenant hint (from the accepted Clerk invite's metadata) to
     * disambiguate when the same email holds PENDING invites to more than one
     * workspace. Without it, the most recent claimable invite wins.
     */
    tenantHint?: string;
}

export type ClaimResult =
    | { claimed: true; tenantSlug: string }
    | { claimed: false };

export type RevokeResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable, no I/O)
// ---------------------------------------------------------------------------

/** The roles an invite may grant. Super admin is the ceiling (M5); anything not
 *  in this set — including a value that isn't a real Role at all — is rejected
 *  before any email goes out. */
const INVITABLE_ROLES: readonly Role[] = ["ADMIN", "MANAGER", "USER"];

export function isInvitableRole(role: Role): boolean {
    return (INVITABLE_ROLES as readonly string[]).includes(role);
}

/** An invite is claimable only while it is PENDING and not past its expiry. */
export function isInviteClaimable(
    invite: { status: string; expiresAt: Date },
    now: Date = new Date()
): boolean {
    return invite.status === "PENDING" && invite.expiresAt > now;
}

/** When a fresh invite expires: INVITE_EXPIRY_DAYS from `now`. */
export function invitationExpiryDate(now: number = Date.now()): Date {
    return new Date(now + INVITE_EXPIRY_DAYS * DAY_MS);
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function prismaErrorCode(err: unknown): string | undefined {
    return (err as { code?: string } | null | undefined)?.code;
}

/** Pull a human message out of a Clerk API error (mirrors createUserForTenant). */
function clerkErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "errors" in err) {
        const e = err as {
            errors: Array<{ message?: string; longMessage?: string }>;
        };
        return (
            e.errors[0]?.longMessage ||
            e.errors[0]?.message ||
            "Could not send the invitation email."
        );
    }
    return "Could not send the invitation email.";
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Invite `email` into `tenantId` with `role`. Validates the role ceiling, blocks
 * an email that already belongs to a workspace (membership is singular), reuses
 * a still-valid pending invite instead of stacking duplicates, then sends the
 * Clerk email and writes our PENDING row. Network I/O is kept OUT of any DB
 * transaction; a failed DB write rolls back the Clerk invite.
 */
export async function inviteToTenant(
    input: InviteToTenantInput,
    transport: InvitationTransport = clerkTransport
): Promise<InviteResult> {
    const email = normalizeEmail(input.email);
    if (!email) {
        return { ok: false, error: "An email address is required." };
    }
    if (input.role === "SUPER_ADMIN") {
        return { ok: false, error: "You can’t invite someone as a super admin." };
    }
    if (!isInvitableRole(input.role)) {
        // A value that isn't a real role (e.g. a hand-crafted form post) must not
        // reach transport.send — otherwise we'd email an invite that then fails
        // to save. Reject up front, before any network I/O.
        return { ok: false, error: "Please choose a valid role." };
    }

    // Membership is singular (User.tenantId is one value): if this email already
    // has a user row anywhere, never silently move them across workspaces (M6).
    const alreadyMember = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
    });
    if (alreadyMember) {
        return { ok: false, error: "This person already belongs to a workspace." };
    }

    const tenant = await db.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true, name: true },
    });
    if (!tenant) {
        return { ok: false, error: "Workspace not found." };
    }

    // TODO(billing): seat check before invite — each accepted invite is a seat.
    // Left as a seam on purpose (PRD 12 §6 non-goals); no limit is enforced here.

    // At most one PENDING invite per (email, tenantId): reuse a still-valid one
    // (no duplicate row, no second email); retire an expired one and issue fresh.
    const existing = await db.invitation.findFirst({
        where: { email, tenantId: input.tenantId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
    });
    if (existing && isInviteClaimable(existing)) {
        // Reuse the live invite — no duplicate row, no second email. If the
        // inviter picked a different role this time, honor it; otherwise the
        // pending invite would silently keep the stale role.
        if (existing.role !== input.role) {
            const updated = await db.invitation.update({
                where: { id: existing.id },
                data: { role: input.role },
            });
            return { ok: true, invitation: updated };
        }
        return { ok: true, invitation: existing };
    }
    if (existing) {
        await db.invitation.update({
            where: { id: existing.id },
            data: { status: "EXPIRED" },
        });
    }

    let clerkInvitationId: string;
    try {
        const sent = await transport.send({
            email,
            tenantId: input.tenantId,
            tenantName: tenant.name,
            role: input.role,
            expiresInDays: INVITE_EXPIRY_DAYS,
        });
        clerkInvitationId = sent.id;
    } catch (err) {
        return { ok: false, error: clerkErrorMessage(err) };
    }

    try {
        const invitation = await db.invitation.create({
            data: {
                email,
                tenantId: input.tenantId,
                role: input.role,
                status: "PENDING",
                invitedById: input.invitedById,
                clerkInvitationId,
                expiresAt: invitationExpiryDate(),
            },
        });
        return { ok: true, invitation };
    } catch {
        // A failed DB write must not strand a live email link — roll the Clerk
        // invite back (best-effort), mirroring createUserForTenant's rollback.
        await transport.revoke(clerkInvitationId).catch(() => {});
        return { ok: false, error: "Could not save the invitation. Please try again." };
    }
}

/**
 * Claim-at-login: turn a PENDING invite for this just-signed-in user into a
 * membership. Idempotent — a second call finds the user already exists and
 * returns the same workspace. Returns { claimed: false } when there is nothing
 * to claim (caller then falls through to self-serve onboarding).
 */
export async function claimInvitationForUser(
    input: ClaimInput
): Promise<ClaimResult> {
    const email = normalizeEmail(input.email);

    // Idempotency: a row already exists (second login, or a concurrent claim) →
    // just route them to their workspace, don't try to claim again.
    const existingUser = await db.user.findUnique({
        where: { id: input.clerkUserId },
        include: { tenant: true },
    });
    if (existingUser) {
        return existingUser.tenant
            ? { claimed: true, tenantSlug: existingUser.tenant.slug }
            : { claimed: false };
    }

    const candidates = (
        await db.invitation.findMany({
            where: { email, status: "PENDING" },
            orderBy: { createdAt: "desc" },
        })
    ).filter((inv) => isInviteClaimable(inv));

    const chosen = input.tenantHint
        ? candidates.find((inv) => inv.tenantId === input.tenantHint) ?? null
        : candidates[0] ?? null;

    if (!chosen) {
        return { claimed: false };
    }

    try {
        const tenantSlug = await db.$transaction(async (tx) => {
            // Re-read inside the transaction so a concurrent revoke/expire/claim
            // can't be raced past.
            const inv = await tx.invitation.findUnique({ where: { id: chosen.id } });
            if (!inv || !isInviteClaimable(inv)) {
                return null;
            }
            const tenant = await tx.tenant.findUnique({
                where: { id: inv.tenantId },
            });
            if (!tenant) {
                return null;
            }

            await tx.user.create({
                data: {
                    id: input.clerkUserId,
                    email,
                    firstName: input.firstName || "User",
                    lastName: input.lastName || null,
                    role: inv.role,
                    tenantId: inv.tenantId,
                },
            });
            await tx.invitation.update({
                where: { id: inv.id },
                data: { status: "ACCEPTED", acceptedAt: new Date() },
            });
            return tenant.slug;
        });

        return tenantSlug ? { claimed: true, tenantSlug } : { claimed: false };
    } catch (err) {
        // A concurrent claim created the user first — return their tenant so the
        // double-login race resolves to the same workspace, idempotently.
        if (prismaErrorCode(err) === "P2002") {
            const u = await db.user.findUnique({
                where: { id: input.clerkUserId },
                include: { tenant: true },
            });
            if (u?.tenant) {
                return { claimed: true, tenantSlug: u.tenant.slug };
            }
        }
        throw err;
    }
}

/**
 * Revoke a pending invite. Scoped to `byTenantId` — a caller can only revoke
 * their own workspace's invites (M5); another tenant's invite reads as "not
 * found" so its existence doesn't leak. Best-effort revokes the Clerk invite.
 */
export async function revokeInvitation(
    invitationId: string,
    byTenantId: string,
    transport: InvitationTransport = clerkTransport
): Promise<RevokeResult> {
    const invite = await db.invitation.findUnique({ where: { id: invitationId } });
    if (!invite || invite.tenantId !== byTenantId) {
        return { ok: false, error: "Invitation not found." };
    }
    if (invite.status === "ACCEPTED") {
        return { ok: false, error: "This invitation was already accepted." };
    }
    if (invite.status !== "REVOKED") {
        await db.invitation.update({
            where: { id: invite.id },
            data: { status: "REVOKED" },
        });
    }
    if (invite.clerkInvitationId) {
        await transport.revoke(invite.clerkInvitationId).catch(() => {});
    }
    return { ok: true };
}

/** The still-valid pending invites for a workspace, newest first (for the UI). */
export async function listPendingInvitations(
    tenantId: string
): Promise<Invitation[]> {
    return db.invitation.findMany({
        where: { tenantId, status: "PENDING", expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
    });
}
