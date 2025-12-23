"use server";

import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Plan } from "@/generated/prisma";

/**
 * Create a new tenant
 */
export async function createTenant(formData: FormData) {
    // Verify superadmin access
    await requireSuperAdmin();

    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const plan = formData.get("plan") as Plan;

    // Validate inputs
    if (!name || !slug) {
        return { error: "Name and slug are required" };
    }

    // Check if slug already exists
    const existingTenant = await db.tenant.findUnique({
        where: { slug },
    });

    if (existingTenant) {
        return { error: "A tenant with this slug already exists" };
    }

    // Create tenant
    const tenant = await db.tenant.create({
        data: {
            name,
            slug: slug.toLowerCase().replace(/\s+/g, "-"),
            plan: plan || "FREE",
        },
    });

    // Revalidate the tenants list
    revalidatePath("/admin/tenants");

    // Redirect to tenant detail page
    redirect(`/admin/tenants/${tenant.id}`);
}

/**
 * Update an existing tenant
 */
export async function updateTenant(tenantId: string, formData: FormData) {
    // Verify superadmin access
    await requireSuperAdmin();

    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const plan = formData.get("plan") as Plan;
    const isActive = formData.get("isActive") === "true";

    // Validate inputs
    if (!name || !slug) {
        return { error: "Name and slug are required" };
    }

    // Check if slug already exists (for another tenant)
    const existingTenant = await db.tenant.findFirst({
        where: {
            slug,
            NOT: { id: tenantId },
        },
    });

    if (existingTenant) {
        return { error: "A tenant with this slug already exists" };
    }

    // Update tenant
    await db.tenant.update({
        where: { id: tenantId },
        data: {
            name,
            slug: slug.toLowerCase().replace(/\s+/g, "-"),
            plan: plan || "FREE",
            isActive,
        },
    });

    // Revalidate
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${tenantId}`);

    redirect(`/admin/tenants/${tenantId}`);
}

/**
 * Delete a tenant
 */
export async function deleteTenant(tenantId: string) {
    // Verify superadmin access
    await requireSuperAdmin();

    // Delete tenant (cascade will delete users and assets)
    await db.tenant.delete({
        where: { id: tenantId },
    });

    // Revalidate
    revalidatePath("/admin/tenants");

    redirect("/admin/tenants");
}
