"use server";

import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Field type definition
export interface FieldDefinition {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "select" | "date" | "boolean";
    required: boolean;
    placeholder?: string;
    options?: string[]; // For select type
    helpText?: string;
}

/**
 * Create a new asset category
 */
export async function createCategory(tenantSlug: string, formData: FormData) {
    const { tenant } = await requireTenantAccess(tenantSlug);

    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const icon = formData.get("icon") as string | null;
    const fieldSchemaRaw = formData.get("fieldSchema") as string;

    if (!name) {
        return { error: "Category name is required" };
    }

    // Check if category already exists
    const existing = await db.assetCategory.findFirst({
        where: { tenantId: tenant.id, name },
    });

    if (existing) {
        return { error: "A category with this name already exists" };
    }

    // Parse and validate field schema
    let fieldSchema: FieldDefinition[] = [];
    try {
        if (fieldSchemaRaw) {
            fieldSchema = JSON.parse(fieldSchemaRaw);
        }
    } catch {
        return { error: "Invalid field schema format" };
    }

    const category = await db.assetCategory.create({
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema,
            tenantId: tenant.id,
        },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}

/**
 * Update an existing category
 */
export async function updateCategory(
    tenantSlug: string,
    categoryId: string,
    formData: FormData
) {
    const { tenant } = await requireTenantAccess(tenantSlug);

    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const icon = formData.get("icon") as string | null;
    const fieldSchemaRaw = formData.get("fieldSchema") as string;
    const isActive = formData.get("isActive") === "true";

    if (!name) {
        return { error: "Category name is required" };
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
        return { error: "A category with this name already exists" };
    }

    let fieldSchema: FieldDefinition[] = [];
    try {
        if (fieldSchemaRaw) {
            fieldSchema = JSON.parse(fieldSchemaRaw);
        }
    } catch {
        return { error: "Invalid field schema format" };
    }

    await db.assetCategory.update({
        where: { id: categoryId },
        data: {
            name,
            description,
            icon,
            fieldSchema: fieldSchema,
            isActive,
        },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}

/**
 * Delete a category
 */
export async function deleteCategory(tenantSlug: string, categoryId: string) {
    await requireTenantAccess(tenantSlug);

    // Check if category has assets
    const assetCount = await db.asset.count({
        where: { categoryId },
    });

    if (assetCount > 0) {
        return { error: `Cannot delete category with ${assetCount} assets. Move or delete assets first.` };
    }

    await db.assetCategory.delete({
        where: { id: categoryId },
    });

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}
