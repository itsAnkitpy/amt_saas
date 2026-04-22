"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    assignAssetForTenant,
    createAssetForTenant,
    deleteAssetForTenant,
    getAssetServiceErrorMessage,
    unassignAssetForTenant,
    updateAssetForTenant,
} from "@/lib/asset-service";

/**
 * Create a new asset
 */
export async function createAsset(tenantSlug: string, formData: FormData) {
    let assetId: string;

    try {
        const asset = await createAssetForTenant(tenantSlug, formData);
        assetId = asset.id;
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                "Failed to create asset"
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/assets`);
    redirect(`/t/${tenantSlug}/assets/${assetId}`);
}

/**
 * Update an existing asset
 */
export async function updateAsset(
    tenantSlug: string,
    assetId: string,
    formData: FormData
) {
    try {
        await updateAssetForTenant(tenantSlug, assetId, formData);
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                "Failed to update asset"
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/assets`);
    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    redirect(`/t/${tenantSlug}/assets/${assetId}`);
}

/**
 * Delete an asset
 */
export async function deleteAsset(tenantSlug: string, assetId: string) {
    try {
        await deleteAssetForTenant(tenantSlug, assetId);
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                "Failed to delete asset"
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/assets`);
    redirect(`/t/${tenantSlug}/assets`);
}

/**
 * Assign asset to a user
 */
export async function assignAsset(
    tenantSlug: string,
    assetId: string,
    userId: string,
    notes?: string
) {
    try {
        await assignAssetForTenant(tenantSlug, assetId, userId, notes);
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                "Failed to assign asset"
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    revalidatePath(`/t/${tenantSlug}/assets`);
}

/**
 * Unassign asset from user
 */
export async function unassignAsset(
    tenantSlug: string,
    assetId: string,
    notes?: string
) {
    try {
        await unassignAssetForTenant(tenantSlug, assetId, notes);
    } catch (error) {
        return {
            error: getAssetServiceErrorMessage(
                error,
                "Failed to unassign asset"
            ),
        };
    }

    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    revalidatePath(`/t/${tenantSlug}/assets`);
}
