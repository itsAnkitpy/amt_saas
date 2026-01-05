/**
 * Bulk Actions API
 * 
 * POST - Perform bulk operations on multiple assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi, requireRole } from '@/lib/auth';
import { handleApiError, badRequest, notFound } from '@/lib/api-error';
import { logBulkAssetActivity, getUserDisplayName } from '@/lib/activity-log';
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
 * Requires: MANAGER role or higher
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

        const { user, tenant } = authResult;

        // RBAC: Require MANAGER role for bulk operations
        const roleError = requireRole(user, 'MANAGER');
        if (roleError) {
            return NextResponse.json(
                { error: roleError.error },
                { status: roleError.status }
            );
        }

        const body: BulkActionRequest = await request.json();
        const { action, assetIds, data } = body;

        // Validate request
        if (!action || !assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            throw badRequest('action and assetIds are required');
        }

        // Limit bulk operations
        if (assetIds.length > 1000) {
            throw badRequest('Cannot process more than 1000 assets at once');
        }

        // Verify all assets belong to this tenant
        const assetCount = await db.asset.count({
            where: {
                id: { in: assetIds },
                tenantId: tenant.id
            }
        });

        if (assetCount !== assetIds.length) {
            throw notFound('Some assets not found or do not belong to this tenant');
        }

        let result: { count: number };

        switch (action) {
            case 'update_status':
                if (!data?.status || !VALID_STATUSES.includes(data.status)) {
                    throw badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
                }

                result = await db.asset.updateMany({
                    where: {
                        id: { in: assetIds },
                        tenantId: tenant.id
                    },
                    data: { status: data.status as AssetStatus }
                });

                // Log status change activity
                await logBulkAssetActivity(
                    'STATUS_CHANGED',
                    assetIds,
                    authResult.user.id,
                    getUserDisplayName(authResult.user),
                    tenant.id,
                    { to: data.status }
                );
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

                // Log assign activity
                await logBulkAssetActivity(
                    'ASSIGNED',
                    assetIds,
                    authResult.user.id,
                    getUserDisplayName(authResult.user),
                    tenant.id,
                    { assignedTo: `${assignee.firstName} ${assignee.lastName || ''}`.trim() }
                );
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

                // Log unassign activity
                await logBulkAssetActivity(
                    'UNASSIGNED',
                    assetIds,
                    authResult.user.id,
                    getUserDisplayName(authResult.user),
                    tenant.id
                );
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

                // Log delete activity
                await logBulkAssetActivity(
                    'DELETED',
                    assetIds,
                    authResult.user.id,
                    getUserDisplayName(authResult.user),
                    tenant.id,
                    { reason: 'bulk_delete' }
                );
                break;

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            action,
            count: result.count
        });

    } catch (error) {
        return handleApiError(error);
    }
}
