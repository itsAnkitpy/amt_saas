import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

interface RouteParams {
    params: Promise<{ slug: string }>;
}

/**
 * GET /api/tenants/[slug]/assets/lookup?q=...
 * 
 * Lookup an asset by ID, serial number, or asset tag
 * Used by the scan page to quickly find assets
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { slug } = await params;
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
        }

        // Get user from database (User.id = clerkUser.id)
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

        const trimmedQuery = query.trim();

        // Build search conditions - handle nullable fields
        const searchConditions = [
            { id: trimmedQuery },
            ...(trimmedQuery ? [{ serialNumber: trimmedQuery }] : []),
            ...(trimmedQuery ? [{ assetTag: trimmedQuery }] : []),
        ];

        // Search by ID, serial number, or asset tag
        const asset = await db.asset.findFirst({
            where: {
                tenantId: tenant.id,
                OR: searchConditions,
            },
            select: {
                id: true,
                name: true,
                serialNumber: true,
                assetTag: true,
                status: true,
            },
        });

        return NextResponse.json({ asset: asset || null });
    } catch (error) {
        console.error('Asset lookup error:', error);
        return NextResponse.json(
            { error: 'Failed to lookup asset' },
            { status: 500 }
        );
    }
}
