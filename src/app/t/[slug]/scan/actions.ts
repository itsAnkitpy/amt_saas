'use server';

import { revalidatePath } from 'next/cache';
import {
    assignAssetForTenant,
    getAssetServiceErrorMessage,
    unassignAssetForTenant,
} from '@/lib/asset-service';

/**
 * Quick assign asset from scan page
 */
export async function quickAssignAsset(
    tenantSlug: string,
    assetId: string,
    userId: string
) {
    try {
        await assignAssetForTenant(
            tenantSlug,
            assetId,
            userId,
            'Assigned via scan'
        );
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                'Failed to assign asset'
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/scan`);
    revalidatePath(`/t/${tenantSlug}/assets`);

    return { success: true };
}

/**
 * Quick unassign/return asset from scan page
 */
export async function quickUnassignAsset(
    tenantSlug: string,
    assetId: string
) {
    try {
        await unassignAssetForTenant(
            tenantSlug,
            assetId,
            'Returned via scan'
        );
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                'Failed to return asset'
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/scan`);
    revalidatePath(`/t/${tenantSlug}/assets`);

    return { success: true };
}
