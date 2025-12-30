import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { syncUser } from '@/lib/sync-user';

/**
 * GET /api/user/me
 * 
 * Returns the current user's data including accessible tenants.
 * Used by the mobile app to determine routing after login.
 */
export async function GET() {
    try {
        const clerkUser = await currentUser();

        if (!clerkUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Sync user first (creates if not exists)
        const dbUser = await syncUser();

        if (!dbUser) {
            return NextResponse.json({
                user: null,
                tenants: [],
                currentTenant: null,
            });
        }

        // Get accessible tenants based on user role
        let tenants;
        if (dbUser.isSuperAdmin) {
            // Super admins can access all active tenants
            tenants = await db.tenant.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    plan: true,
                },
            });
        } else if (dbUser.tenantId) {
            // Regular users only see their tenant
            const tenant = await db.tenant.findUnique({
                where: { id: dbUser.tenantId },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    plan: true,
                },
            });
            tenants = tenant ? [tenant] : [];
        } else {
            // User without tenant
            tenants = [];
        }

        // Find current tenant
        const currentTenant = tenants.find(t => t.id === dbUser.tenantId) || null;

        return NextResponse.json({
            user: {
                id: dbUser.id,
                email: dbUser.email,
                firstName: dbUser.firstName,
                lastName: dbUser.lastName,
                role: dbUser.role,
                isSuperAdmin: dbUser.isSuperAdmin,
                tenantId: dbUser.tenantId,
            },
            tenants,
            currentTenant,
        });
    } catch (error) {
        console.error('Error in /api/user/me:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
