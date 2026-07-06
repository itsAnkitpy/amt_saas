import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { destinationForUser } from "@/lib/onboarding";
import { claimInvitationForUser } from "@/lib/invitation-service";

/**
 * Decide where the current user belongs, as a redirect path. Server-only (it
 * reads Clerk + the DB); the pure decision lives in destinationForUser. This is
 * the one source of truth for post-signup routing, so every page that gates on
 * onboarding state stays in agreement (DRY).
 */
export async function resolveDestination(): Promise<string> {
    const clerkUser = await currentUser();
    if (!clerkUser) {
        return "/sign-in";
    }

    const user = await db.user.findUnique({
        where: { id: clerkUser.id },
        include: { tenant: true },
    });

    // No DB row yet (a fresh signup). Before defaulting to self-serve onboarding,
    // check whether they arrived on a teammate invite and claim it — landing them
    // inside the inviting workspace instead of creating their own (PRD 12 / M3).
    if (!user) {
        const email =
            clerkUser.primaryEmailAddress?.emailAddress ??
            clerkUser.emailAddresses[0]?.emailAddress;
        if (email) {
            // Clerk copies an invite's publicMetadata onto the user on accept, so
            // tenantId picks the exact workspace when one email holds invites to
            // more than one (M6 disambiguation); otherwise the newest invite wins.
            const meta = clerkUser.publicMetadata as { tenantId?: unknown };
            const tenantHint =
                typeof meta?.tenantId === "string" ? meta.tenantId : undefined;

            const claim = await claimInvitationForUser({
                clerkUserId: clerkUser.id,
                email,
                firstName: clerkUser.firstName ?? "User",
                lastName: clerkUser.lastName,
                tenantHint,
            });
            if (claim.claimed) {
                return `/t/${claim.tenantSlug}/dashboard`;
            }
        }
    }

    return destinationForUser(user);
}
