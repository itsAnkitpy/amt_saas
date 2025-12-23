"use server";

import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Create a new asset
 */
export async function createAsset(tenantSlug: string, formData: FormData) {
    const { tenant } = await requireTenantAccess(tenantSlug);

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
    const { tenant } = await requireTenantAccess(tenantSlug);

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

    revalidatePath(`/t/${tenantSlug}/assets`);
    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    redirect(`/t/${tenantSlug}/assets/${assetId}`);
}

/**
 * Delete an asset
 */
export async function deleteAsset(tenantSlug: string, assetId: string) {
    await requireTenantAccess(tenantSlug);

    await db.asset.delete({
        where: { id: assetId },
    });

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
    const { tenant } = await requireTenantAccess(tenantSlug);

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
    await requireTenantAccess(tenantSlug);

    // Find current assignment and close it
    const currentAssignment = await db.assetAssignment.findFirst({
        where: { assetId, returnedAt: null },
        orderBy: { assignedAt: "desc" },
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

    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    revalidatePath(`/t/${tenantSlug}/assets`);
}
