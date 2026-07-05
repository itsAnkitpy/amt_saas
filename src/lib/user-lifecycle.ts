import { db } from "@/lib/db";

/** What handleUserDeleted did, for the webhook to log and for tests to assert. */
export type UserDeletionOutcome =
    | { deleted: false } // no DB row (e.g. an abandoned signup) — nothing to do
    | { deleted: true; deactivatedTenantId: string | null };

/**
 * Clean up after a user deleted in Clerk, without leaving a headless workspace.
 *
 * Self-serve signups have NO DB row until they build a workspace, so a delete
 * for an abandoned signup is a safe no-op — not an error. If the deleted user
 * was a workspace's ADMIN and no active admin remains, the workspace is marked
 * inactive rather than silently orphaning its assets/teammates under no owner.
 *
 * NOTE: tenant.isActive is currently a superadmin-visible flag, not an access
 * gate — this marks the orphan for cleanup; enforcement belongs to a later
 * account-lifecycle pass. Pure DB I/O (no Clerk/svix) so it is DB-testable.
 */
export async function handleUserDeleted(
    userId: string
): Promise<UserDeletionOutcome> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, tenantId: true },
    });

    if (!user) {
        return { deleted: false };
    }

    await db.user.delete({ where: { id: userId } });

    if (user.tenantId && user.role === "ADMIN") {
        const remainingAdmins = await db.user.count({
            where: { tenantId: user.tenantId, role: "ADMIN", isActive: true },
        });
        if (remainingAdmins === 0) {
            await db.tenant.update({
                where: { id: user.tenantId },
                data: { isActive: false },
            });
            return { deleted: true, deactivatedTenantId: user.tenantId };
        }
    }

    return { deleted: true, deactivatedTenantId: null };
}
