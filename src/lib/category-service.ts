import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    CreateCategorySchema,
    UpdateCategorySchema,
    validateFormData,
    type FieldDefinition,
} from "@/lib/validations";

type CategoryFieldSchema = FieldDefinition[];

async function requireCategoryAdminContext(tenantSlug: string) {
    const context = await requireTenantAccess(tenantSlug);

    if (!hasRole(context.user, "ADMIN")) {
        throw new Error("You need ADMIN role to manage categories");
    }

    return context;
}

async function getCategoryForTenantOrThrow(categoryId: string, tenantId: string) {
    const category = await db.assetCategory.findFirst({
        where: {
            id: categoryId,
            tenantId,
        },
        select: { id: true },
    });

    if (!category) {
        throw new Error("Category not found");
    }

    return category;
}

async function ensureCategoryNameAvailable(
    tenantId: string,
    name: string,
    excludeCategoryId?: string
) {
    const existingCategory = await db.assetCategory.findFirst({
        where: {
            tenantId,
            name,
            ...(excludeCategoryId
                ? { NOT: { id: excludeCategoryId } }
                : {}),
        },
        select: { id: true },
    });

    if (existingCategory) {
        throw new Error("A category with this name already exists");
    }
}

export async function createCategoryForTenant(
    tenantSlug: string,
    formData: FormData
) {
    const { tenant } = await requireCategoryAdminContext(tenantSlug);

    const result = validateFormData(CreateCategorySchema, formData);
    if (!result.success) {
        throw new Error(result.error);
    }

    const {
        name,
        description,
        icon,
        fieldSchema,
        defaultMaintenanceIntervalValue,
        defaultMaintenanceIntervalUnit,
        defaultMaintenanceInstructions,
    } = result.data;

    await ensureCategoryNameAvailable(tenant.id, name);

    await db.assetCategory.create({
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema as unknown as CategoryFieldSchema,
            tenantId: tenant.id,
            defaultMaintenanceIntervalValue:
                defaultMaintenanceIntervalValue ?? null,
            defaultMaintenanceIntervalUnit:
                defaultMaintenanceIntervalUnit ?? null,
            defaultMaintenanceInstructions:
                defaultMaintenanceInstructions ?? null,
        },
    });
}

export async function updateCategoryForTenant(
    tenantSlug: string,
    categoryId: string,
    formData: FormData
) {
    const { tenant } = await requireCategoryAdminContext(tenantSlug);

    const result = validateFormData(UpdateCategorySchema, formData);
    if (!result.success) {
        throw new Error(result.error);
    }

    const {
        name,
        description,
        icon,
        fieldSchema,
        isActive,
        defaultMaintenanceIntervalValue,
        defaultMaintenanceIntervalUnit,
        defaultMaintenanceInstructions,
    } = result.data;

    if (!name) {
        throw new Error("Category name is required");
    }

    const category = await getCategoryForTenantOrThrow(categoryId, tenant.id);

    await ensureCategoryNameAvailable(tenant.id, name, category.id);

    await db.assetCategory.update({
        where: { id: category.id },
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema as unknown as CategoryFieldSchema,
            isActive,
            defaultMaintenanceIntervalValue:
                defaultMaintenanceIntervalValue ?? null,
            defaultMaintenanceIntervalUnit:
                defaultMaintenanceIntervalUnit ?? null,
            defaultMaintenanceInstructions:
                defaultMaintenanceInstructions ?? null,
        },
    });
}

export async function deleteCategoryForTenant(
    tenantSlug: string,
    categoryId: string
) {
    const { tenant } = await requireCategoryAdminContext(tenantSlug);
    const category = await getCategoryForTenantOrThrow(categoryId, tenant.id);

    const assetCount = await db.asset.count({
        where: {
            categoryId: category.id,
            tenantId: tenant.id,
        },
    });

    if (assetCount > 0) {
        throw new Error(
            `Cannot delete category with ${assetCount} assets. Move or delete assets first.`
        );
    }

    await db.assetCategory.delete({
        where: { id: category.id },
    });
}
