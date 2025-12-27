/**
 * Tenant Activity API
 * 
 * GET - Fetch paginated activity log for entire tenant (all assets)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { AssetAction, Prisma } from '@/generated/prisma';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

const VALID_ACTIONS: AssetAction[] = [
    'CREATED', 'UPDATED', 'ASSIGNED', 'UNASSIGNED',
    'STATUS_CHANGED', 'DELETED', 'RESTORED', 'IMAGE_ADDED', 'IMAGE_REMOVED'
];

/**
 * GET /api/tenants/{slug}/activity
 * Returns paginated activity log for all assets in a tenant
 * 
 * Query params:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 25, max: 100)
 * - action: filter by action type (optional)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;
        const { searchParams } = new URL(request.url);

        // Parse query params
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
        const actionFilter = searchParams.get('action');

        // Build where clause with proper Prisma typing
        const where: Prisma.AssetActivityWhereInput = { tenantId: tenant.id };
        if (actionFilter && VALID_ACTIONS.includes(actionFilter as AssetAction)) {
            where.action = actionFilter as AssetAction;
        }

        const [activities, total] = await Promise.all([
            db.assetActivity.findMany({
                where,
                include: {
                    asset: {
                        select: { id: true, name: true, assetTag: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            db.assetActivity.count({ where }),
        ]);

        return NextResponse.json({
            activities,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Tenant activity fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
