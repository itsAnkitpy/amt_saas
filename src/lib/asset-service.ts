import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    getUserDisplayName,
    logAssetActivity,
} from "@/lib/activity-log";
import { Prisma } from "@/generated/prisma";
import {
    CreateAssetSchema,
    type CreateAsset,
    validate,
} from "@/lib/validations";

type AssetServiceContext = Awaited<ReturnType<typeof requireTenantAccess>>;

type AssetMutationDbClient = Pick<
    typeof db,
    "asset" | "assetActivity" | "assetAssignment" | "assetCategory" | "user"
>;

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

function getOptionalTextValue(value: FormDataEntryValue | null): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parseAssetFormData(formData: FormData): CreateAsset {
    let customFields: Record<string, unknown> | null = {};

    const customFieldsRaw = formData.get("customFields");
    if (typeof customFieldsRaw === "string" && customFieldsRaw.trim()) {
        try {
            customFields = JSON.parse(customFieldsRaw) as Record<string, unknown>;
        } catch {
            throw new Error("Invalid custom fields format");
        }
    }

    const rawData = {
        name: getOptionalTextValue(formData.get("name")) ?? "",
        categoryId: getOptionalTextValue(formData.get("categoryId")) ?? "",
        serialNumber: getOptionalTextValue(formData.get("serialNumber")),
        assetTag: getOptionalTextValue(formData.get("assetTag")),
        status: getOptionalTextValue(formData.get("status")) ?? "AVAILABLE",
        condition: getOptionalTextValue(formData.get("condition")) ?? "GOOD",
        location: getOptionalTextValue(formData.get("location")),
        purchasePrice: getOptionalTextValue(formData.get("purchasePrice")),
        purchaseDate: getOptionalTextValue(formData.get("purchaseDate")),
        warrantyEnd: getOptionalTextValue(formData.get("warrantyEnd")),
        notes: getOptionalTextValue(formData.get("notes")),
        customFields,
    };

    const result = validate(CreateAssetSchema, rawData);
    if (!result.success) {
        throw new Error(result.error);
    }

    return result.data;
}

async function requireAssetManagerContext(
    tenantSlug: string
): Promise<AssetServiceContext> {
    const context = await requireTenantAccess(tenantSlug);

    if (!hasRole(context.user, "MANAGER")) {
        throw new Error("You need MANAGER role or higher to manage assets");
    }

    return context;
}

async function getCategoryForTenantOrThrow(
    client: AssetMutationDbClient,
    categoryId: string,
    tenantId: string
) {
    const category = await client.assetCategory.findFirst({
        where: {
            id: categoryId,
            tenantId,
        },
        select: {
            id: true,
            name: true,
        },
    });

    if (!category) {
        throw new Error("Category not found");
    }

    return category;
}

async function ensureIdentifiersAreUnique(
    client: AssetMutationDbClient,
    tenantId: string,
    serialNumber: string | null | undefined,
    assetTag: string | null | undefined,
    excludeAssetId?: string
) {
    const notClause = excludeAssetId ? { NOT: { id: excludeAssetId } } : {};

    const [serialConflict, assetTagConflict] = await Promise.all([
        serialNumber
            ? client.asset.findFirst({
                where: {
                    tenantId,
                    serialNumber,
                    ...notClause,
                },
                select: { id: true },
            })
            : null,
        assetTag
            ? client.asset.findFirst({
                where: {
                    tenantId,
                    assetTag,
                    ...notClause,
                },
                select: { id: true },
            })
            : null,
    ]);

    if (serialConflict) {
        throw new Error("An asset with this serial number already exists");
    }

    if (assetTagConflict) {
        throw new Error("An asset with this asset tag already exists");
    }
}

async function getAssignableUserForTenantOrThrow(
    client: AssetMutationDbClient,
    userId: string,
    tenantId: string
) {
    const assignee = await client.user.findFirst({
        where: {
            id: userId,
            tenantId,
            isActive: true,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
        },
    });

    if (!assignee) {
        throw new Error("Assignee not found");
    }

    return assignee;
}

export async function createAssetForTenant(
    tenantSlug: string,
    formData: FormData
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const assetData = parseAssetFormData(formData);

    if (assetData.status === "ASSIGNED") {
        throw new Error("Use the assign action after creating an asset");
    }

    return db.$transaction(async (tx) => {
        const category = await getCategoryForTenantOrThrow(
            tx,
            assetData.categoryId,
            tenant.id
        );

        await ensureIdentifiersAreUnique(
            tx,
            tenant.id,
            assetData.serialNumber,
            assetData.assetTag
        );

        const asset = await tx.asset.create({
            data: {
                tenantId: tenant.id,
                categoryId: assetData.categoryId,
                name: assetData.name,
                serialNumber: assetData.serialNumber ?? null,
                assetTag: assetData.assetTag ?? null,
                status: assetData.status,
                condition: assetData.condition,
                location: assetData.location ?? null,
                purchasePrice: assetData.purchasePrice ?? null,
                purchaseDate: assetData.purchaseDate ?? null,
                warrantyEnd: assetData.warrantyEnd ?? null,
                notes: assetData.notes ?? null,
                customFields: (assetData.customFields ?? {}) as Prisma.InputJsonValue,
            },
        });

        await logAssetActivity(
            {
                action: "CREATED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: { category: category.name },
            },
            tx
        );

        return asset;
    });
}

export async function updateAssetForTenant(
    tenantSlug: string,
    assetId: string,
    formData: FormData
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const assetData = parseAssetFormData(formData);

    return db.$transaction(async (tx) => {
        const existingAsset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                name: true,
                categoryId: true,
                serialNumber: true,
                assetTag: true,
                status: true,
                condition: true,
                location: true,
                notes: true,
                purchasePrice: true,
                purchaseDate: true,
                warrantyEnd: true,
                customFields: true,
                assignedToId: true,
            },
        });

        if (!existingAsset) {
            throw new Error("Asset not found");
        }

        await getCategoryForTenantOrThrow(tx, assetData.categoryId, tenant.id);

        await ensureIdentifiersAreUnique(
            tx,
            tenant.id,
            assetData.serialNumber,
            assetData.assetTag,
            assetId
        );

        if (assetData.status === "ASSIGNED" && !existingAsset.assignedToId) {
            throw new Error("Use the assign action to mark an asset as assigned");
        }

        if (assetData.status !== "ASSIGNED" && existingAsset.assignedToId) {
            throw new Error(
                "Use the unassign action before changing an assigned asset to another status"
            );
        }

        const changedFields: string[] = [];
        if (existingAsset.name !== assetData.name) changedFields.push("name");
        if (existingAsset.categoryId !== assetData.categoryId) {
            changedFields.push("category");
        }
        if (existingAsset.serialNumber !== assetData.serialNumber) {
            changedFields.push("serialNumber");
        }
        if (existingAsset.assetTag !== assetData.assetTag) {
            changedFields.push("assetTag");
        }
        if (existingAsset.status !== assetData.status) changedFields.push("status");
        if (existingAsset.condition !== assetData.condition) {
            changedFields.push("condition");
        }
        if (existingAsset.location !== assetData.location) {
            changedFields.push("location");
        }
        if (existingAsset.notes !== assetData.notes) changedFields.push("notes");

        const previousPrice = existingAsset.purchasePrice?.toString() ?? null;
        const nextPrice =
            assetData.purchasePrice !== null && assetData.purchasePrice !== undefined
                ? String(assetData.purchasePrice)
                : null;
        if (previousPrice !== nextPrice) changedFields.push("purchasePrice");

        const previousPurchaseDate =
            existingAsset.purchaseDate?.getTime() ?? null;
        const nextPurchaseDate = assetData.purchaseDate?.getTime() ?? null;
        if (previousPurchaseDate !== nextPurchaseDate) {
            changedFields.push("purchaseDate");
        }

        const previousWarrantyEnd =
            existingAsset.warrantyEnd?.getTime() ?? null;
        const nextWarrantyEnd = assetData.warrantyEnd?.getTime() ?? null;
        if (previousWarrantyEnd !== nextWarrantyEnd) {
            changedFields.push("warrantyEnd");
        }

        const previousCustomFields = JSON.stringify(existingAsset.customFields ?? {});
        const nextCustomFields = JSON.stringify(assetData.customFields ?? {});
        if (previousCustomFields !== nextCustomFields) {
            changedFields.push("customFields");
        }

        const asset = await tx.asset.update({
            where: { id: assetId },
            data: {
                categoryId: assetData.categoryId,
                name: assetData.name,
                serialNumber: assetData.serialNumber ?? null,
                assetTag: assetData.assetTag ?? null,
                status: assetData.status,
                condition: assetData.condition,
                location: assetData.location ?? null,
                purchasePrice: assetData.purchasePrice ?? null,
                purchaseDate: assetData.purchaseDate ?? null,
                warrantyEnd: assetData.warrantyEnd ?? null,
                notes: assetData.notes ?? null,
                customFields: (assetData.customFields ?? {}) as Prisma.InputJsonValue,
            },
        });

        await logAssetActivity(
            {
                action: "UPDATED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: {
                    fields: changedFields.length > 0 ? changedFields : ["general"],
                },
            },
            tx
        );

        return asset;
    });
}

export async function deleteAssetForTenant(
    tenantSlug: string,
    assetId: string
) {
    const { tenant } = await requireAssetManagerContext(tenantSlug);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                name: true,
                assignedToId: true,
            },
        });

        if (!asset) {
            throw new Error("Asset not found");
        }

        if (asset.assignedToId) {
            throw new Error("Unassign the asset before deleting it");
        }

        await tx.asset.delete({
            where: { id: asset.id },
        });

        return asset;
    });
}

export async function assignAssetForTenant(
    tenantSlug: string,
    assetId: string,
    assigneeId: string,
    notes?: string
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
            },
        });

        if (!asset) {
            throw new Error("Asset not found");
        }

        if (asset.assignedToId || asset.status === "ASSIGNED") {
            throw new Error("Asset is already assigned");
        }

        const assignee = await getAssignableUserForTenantOrThrow(
            tx,
            assigneeId,
            tenant.id
        );

        await tx.assetAssignment.create({
            data: {
                assetId: asset.id,
                userId: assignee.id,
                notes: notes?.trim() || null,
            },
        });

        await tx.asset.update({
            where: { id: asset.id },
            data: {
                assignedToId: assignee.id,
                status: "ASSIGNED",
            },
        });

        await logAssetActivity(
            {
                action: "ASSIGNED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: {
                    assignedTo: getUserDisplayName(assignee),
                },
            },
            tx
        );

        return asset;
    });
}

export async function unassignAssetForTenant(
    tenantSlug: string,
    assetId: string,
    notes?: string
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
            },
        });

        if (!asset) {
            throw new Error("Asset not found");
        }

        if (!asset.assignedToId || asset.status !== "ASSIGNED") {
            throw new Error("Asset is not currently assigned");
        }

        const currentAssignment = await tx.assetAssignment.findFirst({
            where: {
                assetId: asset.id,
                returnedAt: null,
            },
            orderBy: { assignedAt: "desc" },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!currentAssignment) {
            throw new Error("Active assignment record not found");
        }

        await tx.assetAssignment.update({
            where: { id: currentAssignment.id },
            data: {
                returnedAt: new Date(),
                notes: notes?.trim() || currentAssignment.notes || null,
            },
        });

        await tx.asset.update({
            where: { id: asset.id },
            data: {
                assignedToId: null,
                status: "AVAILABLE",
            },
        });

        await logAssetActivity(
            {
                action: "UNASSIGNED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: {
                    previousAssignee: getUserDisplayName(currentAssignment.user),
                },
            },
            tx
        );

        return asset;
    });
}

export function getAssetServiceErrorMessage(error: unknown, fallback: string) {
    return getErrorMessage(error, fallback);
}
