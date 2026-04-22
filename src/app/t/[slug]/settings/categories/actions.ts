"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    createCategoryForTenant,
    deleteCategoryForTenant,
    updateCategoryForTenant,
} from "@/lib/category-service";

/**
 * Create a new asset category
 * Requires: ADMIN role
 */
export async function createCategory(tenantSlug: string, formData: FormData) {
    await createCategoryForTenant(tenantSlug, formData);

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
    await updateCategoryForTenant(tenantSlug, categoryId, formData);

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}

/**
 * Delete a category
 * Requires: ADMIN role
 */
export async function deleteCategory(tenantSlug: string, categoryId: string) {
    await deleteCategoryForTenant(tenantSlug, categoryId);

    revalidatePath(`/t/${tenantSlug}/settings/categories`);
    redirect(`/t/${tenantSlug}/settings/categories`);
}
