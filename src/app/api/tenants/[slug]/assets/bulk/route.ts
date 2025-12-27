/**
 * Bulk Actions API
 * 
 * POST - Perform bulk operations on multiple assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { AssetStatus } from '@/generated/prisma';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

interface BulkActionRequest {
    action: 'update_status' | 'assign' | 'unassign' | 'delete';
    assetIds: string[];
    data?: {
        status?: string;
        assignedToId?: string;
    };
}

const VALID_STATUSES = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'];

/**
 * POST /api/tenants/[slug]/assets/bulk
 * Perform bulk operations on assets
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
        const body: BulkActionRequest = await request.json();
        const { action, assetIds, data } = body;

        // Validate request
        if (!action || !assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: action and assetIds are required' },
                { status: 400 }
            );
        }

        // Limit bulk operations
        if (assetIds.length > 1000) {
            return NextResponse.json(
                { error: 'Cannot process more than 1000 assets at once' },
                { status: 400 }
            );
        }

        // Verify all assets belong to this tenant
        const assetCount = await db.asset.count({
            where: {
                id: { in: assetIds },
                tenantId: tenant.id
            }
        });

        if (assetCount !== assetIds.length) {
            return NextResponse.json(
                { error: 'Some assets not found or do not belong to this tenant' },
                { status: 404 }
            );
        }

        let result: { count: number };

        switch (action) {
            case 'update_status':
                if (!data?.status || !VALID_STATUSES.includes(data.status)) {
                    return NextResponse.json(
                        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
                        { status: 400 }
                    );
                }

                result = await db.asset.updateMany({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id
                    },
                    data: { status: data.status as AssetStatus }
                });
                break;

            case 'assign':
                if (!data?.assignedToId) {
                    return NextResponse.json(
                        { error: 'assignedToId is required for assign action' },
                        { status: 400 }
                    );
                }

                // Verify user exists and belongs to tenant
                const assignee = await db.user.findFirst({
                    where: { id: data.assignedToId, tenantId: tenant.id }
                });

                if (!assignee) {
                    return NextResponse.json(
                        { error: 'Assignee not found' },
                        { status: 404 }
                    );
                }

                result = await db.asset.updateMany({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id
                    },
                    data: {
                        assignedToId: data.assignedToId,
                        status: 'ASSIGNED'
                    }
                });
                break;

            case 'unassign':
                result = await db.asset.updateMany({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id
                    },
                    data: {
                        assignedToId: null,
                        status: 'AVAILABLE'
                    }
                });
                break;

            case 'delete':
                // Check if any assets are assigned
                const assignedAssets = await db.asset.count({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id,
                        status: 'ASSIGNED'
                    }
                });

                if (assignedAssets > 0) {
                    return NextResponse.json(
                        { error: `Cannot delete ${assignedAssets} assigned assets. Unassign them first.` },
                        { status: 400 }
                    );
                }

                // Soft delete by marking as RETIRED and setting archivedAt
                result = await db.asset.updateMany({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id
                    },
                    data: {
                        status: 'RETIRED',
                        archivedAt: new Date()
                    }
                });
                break;

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }

        // Audit log for bulk actions
        console.log(`[AUDIT] Bulk ${action} by user ${authResult.user.id} on tenant ${tenant.slug}: ${result.count} assets affected. IDs: ${assetIds.slice(0, 5).join(', ')}${assetIds.length > 5 ? '...' : ''}`);

        return NextResponse.json({
            success: true,
            action,
            count: result.count
        });

    } catch (error) {
        console.error('Bulk action error:', error);
        return NextResponse.json(
            { error: 'Failed to perform bulk action' },
            { status: 500 }
        );
    }
}
