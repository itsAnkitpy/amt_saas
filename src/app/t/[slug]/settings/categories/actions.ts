"use server";

import { db } from "@/lib/db";
import { requireTenantAccess, hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CreateCategorySchema, UpdateCategorySchema, validateFormData } from "@/lib/validations";

/**
 * Create a new asset category
 * Requires: ADMIN role
 */
export async function createCategory(tenantSlug: string, formData: FormData) {
    const { user, tenant } = await requireTenantAccess(tenantSlug);

    // RBAC: Require ADMIN role for category management
    if (!hasRole(user, 'ADMIN')) {
        throw new Error("You need ADMIN role to manage categories");
    }

    // Extract and validate data with Zod
    const result = validateFormData(CreateCategorySchema, formData);
    if (!result.success) {
        throw new Error(result.error);
    }

    const { name, description, icon, fieldSchema } = result.data;

    // Check if category already exists
    const existing = await db.assetCategory.findFirst({
        where: { tenantId: tenant.id, name },
    });

    if (existing) {
        throw new Error("A category with this name already exists");
    }

    await db.assetCategory.create({
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema as unknown as object,
            tenantId: tenant.id,
        },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}

/**
 * Update an existing category
 * Requires: ADMIN role
 */
export async function updateCategory(
    tenantSlug: string,
    categoryId: string,
    formData: FormData
) {
    const { user, tenant } = await requireTenantAccess(tenantSlug);

    // RBAC: Require ADMIN role for category management
    if (!hasRole(user, 'ADMIN')) {
        throw new Error("You need ADMIN role to manage categories");
    }

    // Extract and validate data with Zod
    const result = validateFormData(UpdateCategorySchema, formData);
    if (!result.success) {
        throw new Error(result.error);
    }

    const { name, description, icon, fieldSchema, isActive } = result.data;

    if (!name) {
        throw new Error("Category name is required");
    }

    // Check if name already exists for another category
    const existing = await db.assetCategory.findFirst({
        where: {
            tenantId: tenant.id,
            name,
            NOT: { id: categoryId },
        },
    });

    if (existing) {
        throw new Error("A category with this name already exists");
    }

    await db.assetCategory.update({
        where: { id: categoryId },
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema as unknown as object,
            isActive,
        },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}

/**
 * Delete a category
 * Requires: ADMIN role
 */
export async function deleteCategory(tenantSlug: string, categoryId: string) {
    const { user } = await requireTenantAccess(tenantSlug);

    // RBAC: Require ADMIN role for category management
    if (!hasRole(user, 'ADMIN')) {
        throw new Error("You need ADMIN role to manage categories");
    }

    // Check if category has assets
    const assetCount = await db.asset.count({
        where: { categoryId },
    });

    if (assetCount > 0) {
        throw new Error(`Cannot delete category with ${assetCount} assets. Move or delete assets first.`);
    }

    await db.assetCategory.delete({
        where: { id: categoryId },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}
