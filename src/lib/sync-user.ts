import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Ensures a default tenant exists for development.
 * In production, tenants would be created during onboarding.
 */
async function ensureDefaultTenant() {
    const defaultTenantId = "default";

    let tenant = await db.tenant.findUnique({
        where: { id: defaultTenantId },
    });

    if (!tenant) {
        tenant = await db.tenant.create({
            data: {
                id: defaultTenantId,
                name: "Default Organization",
                slug: "default",
            },
        });
        console.log("Created default tenant for development");
    }

    return tenant;
}

/**
 * Syncs the current Clerk user to our PostgreSQL database.
 * Creates the user if they don't exist, or returns existing user.
 * 
 * This is a workaround for local development where webhooks aren't available.
 * In production, webhooks handle this automatically.
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

    // Try to find existing user
    let dbUser = await db.user.findUnique({
        where: { id: clerkUser.id },
    });

    // If user doesn't exist in our DB, create them
    if (!dbUser) {
        try {
            // Ensure default tenant exists first
            await ensureDefaultTenant();

            dbUser = await db.user.create({
                data: {
                    id: clerkUser.id,
                    email: primaryEmail,
                    firstName: clerkUser.firstName || "User",
                    lastName: clerkUser.lastName || null,
                    tenantId: "default", // TODO: Handle proper tenant assignment in onboarding
                },
            });
            console.log(`Synced new user to database: ${clerkUser.id}`);
        } catch (error) {
            // Handle race condition - user might have been created by another request
            console.error("Error creating user:", error);
            dbUser = await db.user.findUnique({
                where: { id: clerkUser.id },
            });
        }
    }

    return dbUser;
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
