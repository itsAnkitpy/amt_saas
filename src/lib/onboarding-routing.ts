import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { destinationForUser } from "@/lib/onboarding";

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

    return destinationForUser(user);
}
