import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Syncs the current Clerk user to our PostgreSQL database.
 * Returns existing user (including superadmin) or creates new regular user.
 *
 * @returns The database user or null if not authenticated
 */
export async function syncUser() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        return null;
    }

    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
        console.error("Clerk user has no email address");
        return null;
    }

    // Try to find existing user (could be superadmin or regular user)
    const dbUser = await db.user.findUnique({
        where: { id: clerkUser.id },
    });

    // If user exists, just return them (including superadmin)
    if (dbUser) {
        return dbUser;
    }

    // User doesn't exist in DB
    // In admin-only mode, users must be pre-created by superadmin
    console.warn(
        `[syncUser] User ${clerkUser.id} (${primaryEmail}) not found in DB. ` +
        `In admin-only mode, superadmin must create users first.`
    );
    return null;
}

/**
 * Gets the current user from our database.
 * Does NOT create user if they don't exist (use syncUser for that).
 *
 * @returns The database user or null
 */
export async function getDbUser() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        return null;
    }

    return db.user.findUnique({
        where: { id: clerkUser.id },
    });
}
