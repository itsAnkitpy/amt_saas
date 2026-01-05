import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { User, Tenant } from "@/generated/prisma";

/**
 * Gets the current authenticated user from our database.
 * Returns null if not authenticated or user not found in DB.
 */
export async function getCurrentUser(): Promise<User | null> {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        return null;
    }

    return db.user.findUnique({
        where: { id: clerkUser.id },
    });
}

/**
 * Gets the current user with their tenant included.
 * Returns null if not authenticated.
 */
export async function getCurrentUserWithTenant(): Promise<
    (User & { tenant: Tenant | null }) | null
> {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        return null;
    }

    return db.user.findUnique({
        where: { id: clerkUser.id },
        include: { tenant: true },
    });
}

/**
 * Requires the current user to be a superadmin.
 * Redirects to /dashboard if not a superadmin.
 * Redirects to /sign-in if not authenticated.
 *
 * @returns The superadmin user
 */
export async function requireSuperAdmin(): Promise<User> {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/sign-in");
    }

    if (!user.isSuperAdmin) {
        redirect("/dashboard");
    }

    return user;
}

/**
 * Requires the current user to have access to a specific tenant.
 * Superadmins can access any tenant.
 * Regular users can only access their own tenant.
 *
 * @param tenantSlug - The tenant slug to check access for
 * @returns The user and tenant
 */
export async function requireTenantAccess(
    tenantSlug: string
): Promise<{ user: User; tenant: Tenant }> {
    const user = await getCurrentUserWithTenant();

    if (!user) {
        redirect("/sign-in");
    }

    // Find the tenant by slug
    const tenant = await db.tenant.findUnique({
        where: { slug: tenantSlug },
    });

    if (!tenant) {
        // Tenant doesn't exist
        redirect("/dashboard");
    }

    // Superadmin can access any tenant
    if (user.isSuperAdmin) {
        return { user, tenant };
    }

    // Regular user must belong to this tenant
    if (user.tenantId !== tenant.id) {
        redirect("/dashboard");
    }

    return { user, tenant };
}

/**
 * Checks if the current user is a superadmin.
 * Does not redirect, just returns boolean.
 */
export async function isSuperAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.isSuperAdmin ?? false;
}

/**
 * API-friendly tenant access check.
 * Returns error object instead of redirecting (suitable for API routes).
 * Use this in API route handlers instead of requireTenantAccess.
 *
 * @param tenantSlug - The tenant slug to check access for
 * @returns User and tenant on success, error object on failure
 */
export async function checkTenantAccessForApi(tenantSlug: string): Promise<
    | { user: User; tenant: Tenant }
    | { error: string; status: number }
> {
    const user = await getCurrentUserWithTenant();

    if (!user) {
        return { error: 'Unauthorized', status: 401 };
    }

    const tenant = await db.tenant.findUnique({
        where: { slug: tenantSlug },
    });

    if (!tenant) {
        return { error: 'Tenant not found', status: 404 };
    }

    // Superadmin can access any tenant
    if (user.isSuperAdmin) {
        return { user, tenant };
    }

    // Regular user must belong to this tenant
    if (user.tenantId !== tenant.id) {
        return { error: 'Access denied', status: 403 };
    }

    return { user, tenant };
}

// ============================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================

/**
 * Role hierarchy for permission checks.
 * Higher number = more permissions.
 */
export const ROLE_HIERARCHY = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    MANAGER: 2,
    USER: 1,
} as const;

export type RoleLevel = keyof typeof ROLE_HIERARCHY;

/**
 * Check if user has the required role level or higher.
 * SuperAdmins always pass.
 *
 * @param user - The user to check
 * @param requiredRole - Minimum role required
 * @returns true if user has sufficient permissions
 */
export function hasRole(
    user: { role: string; isSuperAdmin: boolean },
    requiredRole: RoleLevel
): boolean {
    // SuperAdmin bypasses all role checks
    if (user.isSuperAdmin) return true;

    const userLevel = ROLE_HIERARCHY[user.role as RoleLevel] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole];

    return userLevel >= requiredLevel;
}

/**
 * API guard - returns error response if user lacks required role.
 * Use in API routes after checkTenantAccessForApi.
 *
 * @param user - The user to check
 * @param requiredRole - Minimum role required
 * @returns null if allowed, error object if denied
 */
export function requireRole(
    user: { role: string; isSuperAdmin: boolean },
    requiredRole: RoleLevel
): { error: string; status: number } | null {
    if (!hasRole(user, requiredRole)) {
        return {
            error: `This action requires ${requiredRole} role or higher`,
            status: 403,
        };
    }
    return null;
}
