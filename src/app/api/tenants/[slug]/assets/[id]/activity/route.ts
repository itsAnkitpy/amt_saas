/**
 * Asset Activity API
 * 
 * GET - Fetch paginated activity log for an asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        slug: string;
        id: string;
    }>;
}

/**
 * GET /api/tenants/{slug}/assets/{id}/activity
 * Returns paginated activity log for a specific asset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const pageSize = 20;

        // Verify asset belongs to tenant
        const asset = await db.asset.findFirst({
            where: { id, tenantId: tenant.id },
        });

        if (!asset) {
            return NextResponse.json(
                { error: 'Asset not found' },
                { status: 404 }
            );
        }

        const [activities, total] = await Promise.all([
            db.assetActivity.findMany({
                where: { assetId: id, tenantId: tenant.id },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            db.assetActivity.count({
                where: { assetId: id, tenantId: tenant.id },
            }),
        ]);

        return NextResponse.json({
            activities,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Activity fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
