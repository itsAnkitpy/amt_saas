"use server";

import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { logAssetActivity, getUserDisplayName } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Create a new asset
 */
export async function createAsset(tenantSlug: string, formData: FormData) {
    const { tenant, user } = await requireTenantAccess(tenantSlug);

    const name = formData.get("name") as string;
    const categoryId = formData.get("categoryId") as string;
    const serialNumber = (formData.get("serialNumber") as string) || null;
    const assetTag = (formData.get("assetTag") as string) || null;
    const location = (formData.get("location") as string) || null;
    const status = (formData.get("status") as string) || "AVAILABLE";
    const condition = (formData.get("condition") as string) || "GOOD";
    const notes = (formData.get("notes") as string) || null;
    const customFieldsRaw = formData.get("customFields") as string;

    // Parse financial fields
    const purchasePriceStr = formData.get("purchasePrice") as string;
    const purchaseDateStr = formData.get("purchaseDate") as string;
    const warrantyEndStr = formData.get("warrantyEnd") as string;

    if (!name || !categoryId) {
        return { error: "Name and category are required" };
    }

    // Check serial number uniqueness
    if (serialNumber) {
        const existing = await db.asset.findFirst({
            where: { tenantId: tenant.id, serialNumber },
        });
        if (existing) {
            return { error: "An asset with this serial number already exists" };
        }
    }

    // Check asset tag uniqueness
    if (assetTag) {
        const existing = await db.asset.findFirst({
            where: { tenantId: tenant.id, assetTag },
        });
        if (existing) {
            return { error: "An asset with this asset tag already exists" };
        }
    }

    // Parse custom fields
    let customFields = {};
    try {
        if (customFieldsRaw) {
            customFields = JSON.parse(customFieldsRaw);
        }
    } catch {
        return { error: "Invalid custom fields format" };
    }

    // Get category name for logging
    const category = await db.assetCategory.findUnique({
        where: { id: categoryId },
        select: { name: true },
    });

    const asset = await db.asset.create({
        data: {
            name,
            categoryId,
            serialNumber,
            assetTag,
            location,
            status: status as "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED",
            condition: condition as "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
            notes,
            customFields,
            purchasePrice: purchasePriceStr ? parseFloat(purchasePriceStr) : null,
            purchaseDate: purchaseDateStr ? new Date(purchaseDateStr) : null,
            warrantyEnd: warrantyEndStr ? new Date(warrantyEndStr) : null,
            tenantId: tenant.id,
        },
    });

    // Log activity
    await logAssetActivity({
        action: 'CREATED',
        assetId: asset.id,
        userId: user.id,
        userName: getUserDisplayName(user),
        tenantId: tenant.id,
        details: { category: category?.name || 'Unknown' },
    });

    revalidatePath(`/t/${tenantSlug}/assets`);
    redirect(`/t/${tenantSlug}/assets/${asset.id}`);
}

/**
 * Update an existing asset
 */
export async function updateAsset(
    tenantSlug: string,
    assetId: string,
    formData: FormData
) {
    const { tenant, user } = await requireTenantAccess(tenantSlug);

    const name = formData.get("name") as string;
    const categoryId = formData.get("categoryId") as string;
    const serialNumber = (formData.get("serialNumber") as string) || null;
    const assetTag = (formData.get("assetTag") as string) || null;
    const location = (formData.get("location") as string) || null;
    const status = (formData.get("status") as string) || "AVAILABLE";
    const condition = (formData.get("condition") as string) || "GOOD";
    const notes = (formData.get("notes") as string) || null;
    const customFieldsRaw = formData.get("customFields") as string;

    const purchasePriceStr = formData.get("purchasePrice") as string;
    const purchaseDateStr = formData.get("purchaseDate") as string;
    const warrantyEndStr = formData.get("warrantyEnd") as string;

    if (!name || !categoryId) {
        return { error: "Name and category are required" };
    }

    // Check serial number uniqueness (excluding current asset)
    if (serialNumber) {
        const existing = await db.asset.findFirst({
            where: { tenantId: tenant.id, serialNumber, NOT: { id: assetId } },
        });
        if (existing) {
            return { error: "An asset with this serial number already exists" };
        }
    }

    // Check asset tag uniqueness
    if (assetTag) {
        const existing = await db.asset.findFirst({
            where: { tenantId: tenant.id, assetTag, NOT: { id: assetId } },
        });
        if (existing) {
            return { error: "An asset with this asset tag already exists" };
        }
    }

    let customFields = {};
    try {
        if (customFieldsRaw) {
            customFields = JSON.parse(customFieldsRaw);
        }
    } catch {
        return { error: "Invalid custom fields format" };
    }

    // Get existing asset to detect changes
    const existingAsset = await db.asset.findUnique({
        where: { id: assetId },
        select: { name: true, categoryId: true, serialNumber: true, assetTag: true, location: true, status: true, condition: true, notes: true },
    });

    // Detect changed fields (simple comparison)
    const changedFields: string[] = [];
    if (existingAsset) {
        if (existingAsset.name !== name) changedFields.push('name');
        if (existingAsset.categoryId !== categoryId) changedFields.push('category');
        if (existingAsset.serialNumber !== serialNumber) changedFields.push('serialNumber');
        if (existingAsset.assetTag !== assetTag) changedFields.push('assetTag');
        if (existingAsset.location !== location) changedFields.push('location');
        if (existingAsset.status !== status) changedFields.push('status');
        if (existingAsset.condition !== condition) changedFields.push('condition');
        if (existingAsset.notes !== notes) changedFields.push('notes');
    }

    await db.asset.update({
        where: { id: assetId },
        data: {
            name,
            categoryId,
            serialNumber,
            assetTag,
            location,
            status: status as "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED",
            condition: condition as "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
            notes,
            customFields,
            purchasePrice: purchasePriceStr ? parseFloat(purchasePriceStr) : null,
            purchaseDate: purchaseDateStr ? new Date(purchaseDateStr) : null,
            warrantyEnd: warrantyEndStr ? new Date(warrantyEndStr) : null,
        },
    });

    // Log activity
    await logAssetActivity({
        action: 'UPDATED',
        assetId,
        userId: user.id,
        userName: getUserDisplayName(user),
        tenantId: tenant.id,
        details: { fields: changedFields.length > 0 ? changedFields : ['general'] },
    });

    revalidatePath(`/t/${tenantSlug}/assets`);
    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    redirect(`/t/${tenantSlug}/assets/${assetId}`);
}

/**
 * Delete an asset
 */
export async function deleteAsset(tenantSlug: string, assetId: string) {
    const { tenant, user } = await requireTenantAccess(tenantSlug);

    // Get asset name before deletion for logging
    const asset = await db.asset.findUnique({
        where: { id: assetId },
        select: { name: true },
    });

    await db.asset.delete({
        where: { id: assetId },
    });

    // Log activity (note: asset is deleted, so we can't log after)
    // For hard delete, we'd need to log before or use soft delete
    // Since this is hard delete, we log to console as fallback
    console.log(`[AUDIT] Asset ${asset?.name || assetId} deleted by ${getUserDisplayName(user)} on tenant ${tenant.slug}`);

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
    const { tenant, user } = await requireTenantAccess(tenantSlug);

    // Get assignee name for logging
    const assignee = await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
    });

    // Create assignment record
    await db.assetAssignment.create({
        data: {
            assetId,
            userId,
            notes,
        },
    });

    // Update asset status and assignee
    await db.asset.update({
        where: { id: assetId },
        data: {
            status: "ASSIGNED",
            assignedToId: userId,
        },
    });

    // Log activity
    await logAssetActivity({
        action: 'ASSIGNED',
        assetId,
        userId: user.id,
        userName: getUserDisplayName(user),
        tenantId: tenant.id,
        details: { assignedTo: assignee ? getUserDisplayName(assignee) : 'Unknown' },
    });

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
    const { tenant, user } = await requireTenantAccess(tenantSlug);

    // Find current assignment and close it
    const currentAssignment = await db.assetAssignment.findFirst({
        where: { assetId, returnedAt: null },
        orderBy: { assignedAt: "desc" },
        include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (currentAssignment) {
        await db.assetAssignment.update({
            where: { id: currentAssignment.id },
            data: { returnedAt: new Date(), notes },
        });
    }

    // Update asset status
    await db.asset.update({
        where: { id: assetId },
        data: {
            status: "AVAILABLE",
            assignedToId: null,
        },
    });

    // Log activity
    await logAssetActivity({
        action: 'UNASSIGNED',
        assetId,
        userId: user.id,
        userName: getUserDisplayName(user),
        tenantId: tenant.id,
        details: currentAssignment?.user ? { previousAssignee: getUserDisplayName(currentAssignment.user) } : {},
    });

    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    revalidatePath(`/t/${tenantSlug}/assets`);
}
