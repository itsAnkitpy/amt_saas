import { NextRequest, NextResponse } from "next/server";
import { bulkUpdateAssetStatusForTenant } from "@/lib/asset-service";
import { ASSET_DIRECT_STATUSES, type AssetDirectStatus } from "@/lib/asset-rules";
import { badRequest, handleApiError } from "@/lib/api-error";

interface RouteParams {
    params: Promise<{ slug: string; id: string }>;
}

/**
 * PATCH /api/tenants/[slug]/assets/[id]/status
 *
 * Mobile "quick action" — change a single asset's direct status (AVAILABLE /
 * MAINTENANCE / RETIRED) from the field. Bearer-token authed via proxy.ts.
 *
 * Reuses bulkUpdateAssetStatusForTenant with a one-element array so we inherit
 * its guards for free: MANAGER+ role, tenant scoping, blocks assigned/archived
 * assets, and STATUS_CHANGED activity logging. ASSIGNED is intentionally not a
 * valid target — the domain requires the unassign flow (not in the scan MVP).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id } = await params;

        const body = await request.json().catch(() => null);
        const status = body?.status;

        if (!status || !ASSET_DIRECT_STATUSES.includes(status)) {
            throw badRequest(
                `"status" must be one of: ${ASSET_DIRECT_STATUSES.join(", ")}`
            );
        }

        await bulkUpdateAssetStatusForTenant(slug, [id], status as AssetDirectStatus);

        return NextResponse.json({ success: true, status });
    } catch (error) {
        return handleApiError(error);
    }
}
