/**
 * Activity Log Utility
 * 
 * Functions for logging asset activities for audit trail.
 * User info is stored in details to survive user deletion.
 */

import { db } from '@/lib/db';
import { AssetAction } from '@/generated/prisma';

interface LogActivityParams {
    action: AssetAction;
    assetId: string;
    userId: string;
    userName: string;      // Store for history preservation
    tenantId: string;
    details?: Record<string, unknown>;
}

/**
 * Log a single asset activity
 */
export async function logAssetActivity(params: LogActivityParams) {
    return db.assetActivity.create({
        data: {
            action: params.action,
            assetId: params.assetId,
            userId: params.userId,
            tenantId: params.tenantId,
            details: {
                performedBy: params.userName,
                ...params.details,
            },
        },
    });
}

/**
 * Log activity for multiple assets (bulk operations)
 * Uses createMany for efficiency
 */
export async function logBulkAssetActivity(
    action: AssetAction,
    assetIds: string[],
    userId: string,
    userName: string,
    tenantId: string,
    details?: Record<string, unknown>
) {
    if (assetIds.length === 0) return { count: 0 };

    return db.assetActivity.createMany({
        data: assetIds.map(assetId => ({
            action,
            assetId,
            userId,
            tenantId,
            details: {
                performedBy: userName,
                ...details,
            },
        })),
    });
}

/**
 * Helper to get user's display name
 */
export function getUserDisplayName(user: { firstName: string; lastName?: string | null }): string {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
}
