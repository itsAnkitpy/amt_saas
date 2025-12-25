import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

interface RouteParams {
    params: Promise<{ slug: string }>;
}

/**
 * GET /api/tenants/[slug]/users
 * 
 * Get all users for a tenant (for assignment dropdowns)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { slug } = await params;

        // Get user from database
        const user = await db.user.findUnique({
            where: { id: clerkUser.id },
            select: { tenantId: true, isSuperAdmin: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 403 });
        }

        // Get tenant by slug
        const tenant = await db.tenant.findUnique({
            where: { slug },
            select: { id: true },
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Verify access: user must belong to this tenant or be superadmin
        if (!user.isSuperAdmin && user.tenantId !== tenant.id) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get all active users for this tenant
        const users = await db.user.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
            },
            orderBy: { firstName: 'asc' },
        });

        return NextResponse.json(users);
    } catch (error) {
        console.error('Users lookup error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
