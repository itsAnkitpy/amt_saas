/**
 * Bulk Actions API
 * 
 * POST - Perform bulk operations on multiple assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkTenantAccessForApi, requireRole } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';
import {
    bulkAssignAssetsForTenant,
    bulkDeleteAssetsForTenant,
    bulkRestoreAssetsForTenant,
    bulkUnassignAssetsForTenant,
    bulkUpdateAssetStatusForTenant,
} from '@/lib/asset-service';
import { ASSET_DIRECT_STATUSES, type AssetDirectStatus } from '@/lib/asset-rules';
import { BulkActionSchema, validateBody } from '@/lib/validations';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

/**
 * POST /api/tenants/[slug]/assets/bulk
 * Perform bulk operations on assets
 * Requires: MANAGER role or higher
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if (!authResult.ok) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { user } = authResult;

        // RBAC: Require MANAGER role for bulk operations
        const roleError = requireRole(user, 'MANAGER');
        if (roleError) {
            return NextResponse.json(
                { error: roleError.error },
                { status: roleError.status }
            );
        }

        const body = await request.json();

        // Validate request with Zod
        const validated = validateBody(BulkActionSchema, body);
        if ('error' in validated) return validated.error;

        const { action, data } = validated.data;
        const assetIds = Array.from(new Set(validated.data.assetIds));

        let result: { count: number };

        switch (action) {
            case 'update_status':
                if (
                    !data?.status ||
                    !ASSET_DIRECT_STATUSES.includes(data.status as AssetDirectStatus)
                ) {
                    return NextResponse.json(
                        { error: `Invalid status. Must be one of: ${ASSET_DIRECT_STATUSES.join(', ')}` },
                        { status: 400 }
                    );
                }

                result = await bulkUpdateAssetStatusForTenant(
                    slug,
                    assetIds,
                    data.status as AssetDirectStatus
                );
                break;

            case 'assign':
                if (!data?.assignedToId) {
                    return NextResponse.json(
                        { error: 'assignedToId is required for assign action' },
                        { status: 400 }
                    );
                }

                result = await bulkAssignAssetsForTenant(
                    slug,
                    assetIds,
                    data.assignedToId,
                    'Assigned via bulk action'
                );
                break;

            case 'unassign':
                result = await bulkUnassignAssetsForTenant(
                    slug,
                    assetIds,
                    'Unassigned via bulk action'
                );
                break;

            case 'delete':
                result = await bulkDeleteAssetsForTenant(slug, assetIds);
                break;

            case 'restore':
                result = await bulkRestoreAssetsForTenant(slug, assetIds);
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
