import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    getUserDisplayName,
    logAssetActivity,
    logBulkAssetActivity,
} from "@/lib/activity-log";
import { badRequest, notFound } from "@/lib/api-error";
import { Prisma } from "@/generated/prisma";
import {
    CreateAssetSchema,
    type CreateAsset,
    type FieldDefinition as CategoryFieldDefinition,
    validate,
} from "@/lib/validations";

type AssetServiceContext = Awaited<ReturnType<typeof requireTenantAccess>>;

type AssetMutationDbClient = Pick<
    typeof db,
    "asset" | "assetActivity" | "assetAssignment" | "assetCategory" | "user"
>;

type AssetAssignmentState = {
    id: string;
    status: string;
    assignedToId: string | null;
    archivedAt?: Date | null;
};

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

function isEmptyCustomFieldValue(value: unknown) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0)
    );
}

function normalizeCustomFieldValue(
    field: CategoryFieldDefinition,
    rawValue: unknown
) {
    switch (field.type) {
        case "text":
        case "textarea": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be text`);
            }

            return rawValue.trim();
        }

        case "number": {
            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                return rawValue;
            }

            if (typeof rawValue === "string") {
                const trimmed = rawValue.trim();
                const parsed = Number(trimmed);

                if (trimmed.length > 0 && Number.isFinite(parsed)) {
                    return parsed;
                }
            }

            throw new Error(`${field.label} must be a number`);
        }

        case "select": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be text`);
            }

            const selected = rawValue.trim();
            if (field.options?.length && !field.options.includes(selected)) {
                throw new Error(
                    `${field.label} must be one of: ${field.options.join(", ")}`
                );
            }

            return selected;
        }

        case "date": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be a valid date`);
            }

            const trimmed = rawValue.trim();
            if (Number.isNaN(Date.parse(trimmed))) {
                throw new Error(`${field.label} must be a valid date`);
            }

            return trimmed;
        }

        case "boolean": {
            if (typeof rawValue === "boolean") {
                return rawValue;
            }

            if (typeof rawValue === "string") {
                const normalized = rawValue.trim().toLowerCase();
                if (normalized === "true") return true;
                if (normalized === "false") return false;
            }

            throw new Error(`${field.label} must be true or false`);
        }
    }
}

export function validateAndNormalizeCustomFields(
    customFields: Record<string, unknown> | null | undefined,
    fieldSchema: CategoryFieldDefinition[]
) {
    if (!customFields) {
        customFields = {};
    }

    if (typeof customFields !== "object" || Array.isArray(customFields)) {
        throw new Error("Invalid custom fields format");
    }

    const normalizedFields: Record<string, unknown> = {};

    for (const field of fieldSchema) {
        const rawValue = customFields[field.key];

        if (isEmptyCustomFieldValue(rawValue)) {
            if (field.required) {
                throw new Error(`${field.label} is required`);
            }

            continue;
        }

        normalizedFields[field.key] = normalizeCustomFieldValue(field, rawValue);
    }

    return normalizedFields;
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
            fieldSchema: true,
        },
    });

    if (!category) {
        throw notFound("Category not found");
    }

    return {
        ...category,
        fieldSchema: category.fieldSchema as unknown as CategoryFieldDefinition[],
    };
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
        throw badRequest("An asset with this serial number already exists");
    }

    if (assetTagConflict) {
        throw badRequest("An asset with this asset tag already exists");
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
        throw notFound("Assignee not found");
    }

    return assignee;
}

function assertAssetCanBeAssigned(asset: AssetAssignmentState) {
    if (asset.archivedAt) {
        throw badRequest("Archived assets cannot be assigned");
    }

    if (asset.assignedToId || asset.status === "ASSIGNED") {
        throw badRequest("Asset is already assigned");
    }

    if (asset.status !== "AVAILABLE") {
        throw badRequest("Only available assets can be assigned");
    }
}

function assertAssetCanBeUnassigned(asset: AssetAssignmentState) {
    if (asset.archivedAt) {
        throw badRequest("Archived assets cannot be unassigned");
    }

    if (!asset.assignedToId || asset.status !== "ASSIGNED") {
        throw badRequest("Asset is not currently assigned");
    }
}

function assertAssetNotArchived(asset: { archivedAt: Date | null }) {
    if (asset.archivedAt) {
        throw badRequest("Archived assets cannot be modified");
    }
}

function assertAssetIsArchived(asset: { archivedAt: Date | null }) {
    if (!asset.archivedAt) {
        throw badRequest("Asset is not archived");
    }
}

function dedupeAssetIds(assetIds: string[]) {
    return Array.from(new Set(assetIds));
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
        const normalizedCustomFields = validateAndNormalizeCustomFields(
            assetData.customFields,
            category.fieldSchema
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
                customFields: normalizedCustomFields as Prisma.InputJsonValue,
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
                archivedAt: true,
            },
        });

        if (!existingAsset) {
            throw notFound("Asset not found");
        }

        assertAssetNotArchived(existingAsset);

        const category = await getCategoryForTenantOrThrow(
            tx,
            assetData.categoryId,
            tenant.id
        );
        const normalizedCustomFields = validateAndNormalizeCustomFields(
            assetData.customFields,
            category.fieldSchema
        );

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
        const nextCustomFields = JSON.stringify(normalizedCustomFields);
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
                customFields: normalizedCustomFields as Prisma.InputJsonValue,
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
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);

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
                archivedAt: true,
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetNotArchived(asset);

        if (asset.assignedToId) {
            throw badRequest("Unassign the asset before deleting it");
        }

        const archivedAt = new Date();

        await tx.asset.update({
            where: { id: asset.id },
            data: {
                status: "RETIRED",
                archivedAt,
            },
        });

        await logAssetActivity(
            {
                action: "DELETED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: {
                    reason: "soft_delete",
                    archivedAt: archivedAt.toISOString(),
                },
            },
            tx
        );

        return asset;
    });
}

export async function restoreAssetForTenant(
    tenantSlug: string,
    assetId: string
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
                archivedAt: true,
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetIsArchived(asset);

        const restoredAt = new Date();

        await tx.asset.update({
            where: { id: asset.id },
            data: {
                status: "AVAILABLE",
                archivedAt: null,
            },
        });

        await logAssetActivity(
            {
                action: "RESTORED",
                assetId: asset.id,
                userId: user.id,
                userName: getUserDisplayName(user),
                tenantId: tenant.id,
                details: {
                    previousStatus: asset.status,
                    restoredAt: restoredAt.toISOString(),
                },
            },
            tx
        );

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
                archivedAt: true,
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetCanBeAssigned(asset);

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
                archivedAt: true,
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetCanBeUnassigned(asset);

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
            throw badRequest("Active assignment record not found");
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

export async function bulkUpdateAssetStatusForTenant(
    tenantSlug: string,
    assetIds: string[],
    status: "AVAILABLE" | "MAINTENANCE" | "RETIRED"
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const uniqueAssetIds = dedupeAssetIds(assetIds);

    return db.$transaction(async (tx) => {
        const assets = await tx.asset.findMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
                archivedAt: true,
            },
        });

        if (assets.length !== uniqueAssetIds.length) {
            throw notFound("Some assets not found or do not belong to this tenant");
        }

        const assignedAssetsCount = assets.filter(
            (asset) => asset.assignedToId || asset.status === "ASSIGNED"
        ).length;
        const archivedAssetsCount = assets.filter((asset) => asset.archivedAt).length;

        if (assignedAssetsCount > 0) {
            throw badRequest(
                `Cannot change status for ${assignedAssetsCount} assigned asset(s). Unassign them first.`
            );
        }

        if (archivedAssetsCount > 0) {
            throw badRequest(
                `Cannot change status for ${archivedAssetsCount} archived asset(s).`
            );
        }

        const result = await tx.asset.updateMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            data: { status },
        });

        await logBulkAssetActivity(
            "STATUS_CHANGED",
            uniqueAssetIds,
            user.id,
            getUserDisplayName(user),
            tenant.id,
            { to: status },
            tx
        );

        return { count: result.count };
    });
}

export async function bulkAssignAssetsForTenant(
    tenantSlug: string,
    assetIds: string[],
    assigneeId: string,
    notes?: string
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const uniqueAssetIds = dedupeAssetIds(assetIds);

    return db.$transaction(async (tx) => {
        const assets = await tx.asset.findMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
                archivedAt: true,
            },
        });

        if (assets.length !== uniqueAssetIds.length) {
            throw notFound("Some assets not found or do not belong to this tenant");
        }

        const alreadyAssignedCount = assets.filter(
            (asset) => asset.assignedToId || asset.status === "ASSIGNED"
        ).length;
        const unavailableCount = assets.filter(
            (asset) => !asset.assignedToId && asset.status !== "AVAILABLE"
        ).length;
        const archivedCount = assets.filter((asset) => asset.archivedAt).length;

        if (alreadyAssignedCount > 0 || unavailableCount > 0 || archivedCount > 0) {
            const reasons: string[] = [];

            if (alreadyAssignedCount > 0) {
                reasons.push(`${alreadyAssignedCount} asset(s) are already assigned`);
            }

            if (unavailableCount > 0) {
                reasons.push(
                    `${unavailableCount} asset(s) are not available for assignment`
                );
            }

            if (archivedCount > 0) {
                reasons.push(`${archivedCount} asset(s) are archived`);
            }

            throw badRequest(
                `Cannot assign selected assets: ${reasons.join("; ")}.`
            );
        }

        const assignee = await getAssignableUserForTenantOrThrow(
            tx,
            assigneeId,
            tenant.id
        );
        const assignmentNotes = notes?.trim() || null;

        await tx.assetAssignment.createMany({
            data: uniqueAssetIds.map((assetId) => ({
                assetId,
                userId: assignee.id,
                notes: assignmentNotes,
            })),
        });

        const result = await tx.asset.updateMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            data: {
                assignedToId: assignee.id,
                status: "ASSIGNED",
            },
        });

        await logBulkAssetActivity(
            "ASSIGNED",
            uniqueAssetIds,
            user.id,
            getUserDisplayName(user),
            tenant.id,
            {
                assignedTo: getUserDisplayName(assignee),
            },
            tx
        );

        return { count: result.count };
    });
}

export async function bulkUnassignAssetsForTenant(
    tenantSlug: string,
    assetIds: string[],
    notes?: string
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const uniqueAssetIds = dedupeAssetIds(assetIds);

    return db.$transaction(async (tx) => {
        const assets = await tx.asset.findMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
                archivedAt: true,
            },
        });

        if (assets.length !== uniqueAssetIds.length) {
            throw notFound("Some assets not found or do not belong to this tenant");
        }

        const notAssignedCount = assets.filter(
            (asset) => !asset.assignedToId || asset.status !== "ASSIGNED"
        ).length;
        const archivedCount = assets.filter((asset) => asset.archivedAt).length;

        if (archivedCount > 0) {
            throw badRequest(
                `Cannot unassign ${archivedCount} archived asset(s).`
            );
        }

        if (notAssignedCount > 0) {
            throw badRequest(
                `Cannot unassign ${notAssignedCount} asset(s) because they are not currently assigned.`
            );
        }

        const openAssignments = await tx.assetAssignment.findMany({
            where: {
                assetId: { in: uniqueAssetIds },
                returnedAt: null,
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (openAssignments.length !== uniqueAssetIds.length) {
            throw badRequest(
                "Active assignment records were missing for one or more selected assets"
            );
        }

        await tx.assetAssignment.updateMany({
            where: {
                id: { in: openAssignments.map((assignment) => assignment.id) },
            },
            data: notes?.trim()
                ? {
                    returnedAt: new Date(),
                    notes: notes.trim(),
                }
                : {
                    returnedAt: new Date(),
                },
        });

        const result = await tx.asset.updateMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            data: {
                assignedToId: null,
                status: "AVAILABLE",
            },
        });

        await tx.assetActivity.createMany({
            data: openAssignments.map((assignment) => ({
                action: "UNASSIGNED",
                assetId: assignment.assetId,
                userId: user.id,
                tenantId: tenant.id,
                details: {
                    performedBy: getUserDisplayName(user),
                    previousAssignee: getUserDisplayName(assignment.user),
                },
            })),
        });

        return { count: result.count };
    });
}

export async function bulkDeleteAssetsForTenant(
    tenantSlug: string,
    assetIds: string[]
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const uniqueAssetIds = dedupeAssetIds(assetIds);

    return db.$transaction(async (tx) => {
        const assets = await tx.asset.findMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
                archivedAt: true,
            },
        });

        if (assets.length !== uniqueAssetIds.length) {
            throw notFound("Some assets not found or do not belong to this tenant");
        }

        const assignedCount = assets.filter(
            (asset) => asset.assignedToId || asset.status === "ASSIGNED"
        ).length;
        const archivedCount = assets.filter((asset) => asset.archivedAt).length;

        if (assignedCount > 0) {
            throw badRequest(
                `Cannot delete ${assignedCount} assigned asset(s). Unassign them first.`
            );
        }

        if (archivedCount > 0) {
            throw badRequest(
                `${archivedCount} selected asset(s) are already archived.`
            );
        }

        const archivedAt = new Date();
        const result = await tx.asset.updateMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            data: {
                status: "RETIRED",
                archivedAt,
            },
        });

        await logBulkAssetActivity(
            "DELETED",
            uniqueAssetIds,
            user.id,
            getUserDisplayName(user),
            tenant.id,
            {
                reason: "bulk_soft_delete",
                archivedAt: archivedAt.toISOString(),
            },
            tx
        );

        return { count: result.count };
    });
}

export async function bulkRestoreAssetsForTenant(
    tenantSlug: string,
    assetIds: string[]
) {
    const { tenant, user } = await requireAssetManagerContext(tenantSlug);
    const uniqueAssetIds = dedupeAssetIds(assetIds);

    return db.$transaction(async (tx) => {
        const assets = await tx.asset.findMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            select: {
                id: true,
                archivedAt: true,
            },
        });

        if (assets.length !== uniqueAssetIds.length) {
            throw notFound("Some assets not found or do not belong to this tenant");
        }

        const activeCount = assets.filter((asset) => !asset.archivedAt).length;

        if (activeCount > 0) {
            throw badRequest(
                `${activeCount} selected asset(s) are not archived.`
            );
        }

        const restoredAt = new Date();
        const result = await tx.asset.updateMany({
            where: {
                id: { in: uniqueAssetIds },
                tenantId: tenant.id,
            },
            data: {
                status: "AVAILABLE",
                archivedAt: null,
            },
        });

        await logBulkAssetActivity(
            "RESTORED",
            uniqueAssetIds,
            user.id,
            getUserDisplayName(user),
            tenant.id,
            {
                restoredAt: restoredAt.toISOString(),
                restoredTo: "AVAILABLE",
            },
            tx
        );

        return { count: result.count };
    });
}

export function getAssetServiceErrorMessage(error: unknown, fallback: string) {
    return getErrorMessage(error, fallback);
}
