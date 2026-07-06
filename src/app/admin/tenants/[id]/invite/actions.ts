"use server";

import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { inviteToTenant } from "@/lib/invitation-service";

/**
 * Superadmin door (parity): send an email invitation through the SAME shared
 * engine the client door uses (D3). The teammate sets their own password; our
 * Invitation table stays the source of truth. Throws on failure to surface the
 * message on this internal admin page, matching createUserForTenant's style.
 */
export async function inviteToTenantByEmail(tenantId: string, formData: FormData) {
    const superadmin = await requireSuperAdmin();

    const email = ((formData.get("email") as string | null) ?? "").trim();
    const role = ((formData.get("role") as string | null) ?? "USER") as Role;

    if (!email) {
        throw new Error("Email is required");
    }

    const result = await inviteToTenant({
        tenantId,
        email,
        role,
        invitedById: superadmin.id,
    });
    if (!result.ok) {
        throw new Error(result.error);
    }

    revalidatePath(`/admin/tenants/${tenantId}`);
    redirect(`/admin/tenants/${tenantId}`);
}

/**
 * Create a new user for a tenant (direct creation, no email invite)
 * This creates the user in both Clerk and our database
 */
export async function createUserForTenant(tenantId: string, formData: FormData) {
    // Verify superadmin access
    await requireSuperAdmin();

    const email = formData.get("email") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as Role;

    // Validate inputs
    if (!email || !firstName || !password) {
        throw new Error("Email, first name, and password are required");
    }

    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
    });

    if (!tenant) {
        throw new Error("Tenant not found");
    }

    // Check if user already exists in our DB for this tenant
    const existingUser = await db.user.findFirst({
        where: {
            email,
            tenantId,
        },
    });

    if (existingUser) {
        throw new Error("A user with this email already exists in this tenant");
    }

    let clerkUserId: string;

    try {
        // Create user in Clerk
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.createUser({
            emailAddress: [email],
            firstName,
            lastName: lastName || undefined,
            password,
        });
        clerkUserId = clerkUser.id;
    } catch (error: unknown) {
        console.error("Error creating Clerk user:", JSON.stringify(error, null, 2));

        // Handle Clerk errors
        if (error && typeof error === "object" && "errors" in error) {
            const clerkError = error as { errors: Array<{ message: string; code: string; longMessage?: string }> };
            const firstError = clerkError.errors[0];
            console.error("Clerk error details:", firstError);
            throw new Error(firstError?.longMessage || firstError?.message || "Failed to create user in Clerk");
        }

        throw new Error("Failed to create user. Please try again.");
    }

    try {
        await db.user.create({
            data: {
                id: clerkUserId,
                email,
                firstName,
                lastName: lastName || null,
                role: role || "USER",
                tenantId,
            },
        });
    } catch (error) {
        console.error("Error creating database user:", error);

        try {
            const clerk = await clerkClient();
            await clerk.users.deleteUser(clerkUserId);
        } catch (rollbackError) {
            console.error("Failed to roll back Clerk user:", rollbackError);
        }

        throw new Error(
            error instanceof Error
                ? error.message
                : "Failed to create user in database"
        );
    }

    // Revalidate
    revalidatePath(`/admin/tenants/${tenantId}`);

    // Redirect MUST be outside try-catch (it throws internally)
    redirect(`/admin/tenants/${tenantId}`);
}
