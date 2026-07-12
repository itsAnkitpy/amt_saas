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
                archivedAt: null,
                OR: searchConditions,
            },
            select: {
                id: true,
                name: true,
                serialNumber: true,
                assetTag: true,
                status: true,
                condition: true,
                location: true,
                purchaseDate: true,
                warrantyEnd: true,
                customFields: true,
                category: {
                    select: {
                        name: true,
                        icon: true,
                        fieldSchema: true,
                    },
                },
                images: {
                    select: {
                        thumbBlobUrl: true,
                        blobUrl: true,
                        isPrimary: true,
                    },
                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!asset) {
            return NextResponse.json({ asset: null });
        }

        // Maintenance summary: latest completed job + earliest upcoming job.
        // Both hit the (assetId, status) index; either can be null.
        const [lastCompleted, nextDue] = await Promise.all([
            db.maintenanceJob.findFirst({
                // completedAt not-null: a COMPLETED job missing its timestamp
                // must not count as "last serviced" (and Postgres sorts NULLs
                // first on DESC, which would mask real history).
                where: { assetId: asset.id, status: 'COMPLETED', completedAt: { not: null } },
                orderBy: { completedAt: 'desc' },
                select: { completedAt: true },
            }),
            db.maintenanceJob.findFirst({
                where: { assetId: asset.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
                orderBy: { dueAt: 'asc' },
                select: { dueAt: true },
            }),
        ]);

        return NextResponse.json({
            asset: {
                ...asset,
                maintenance: {
                    lastServicedAt: lastCompleted?.completedAt ?? null,
                    nextDueAt: nextDue?.dueAt ?? null,
                },
            },
        });
    } catch (error) {
        console.error('Asset lookup error:', error);
        return NextResponse.json(
            { error: 'Failed to lookup asset' },
            { status: 500 }
        );
    }
}
