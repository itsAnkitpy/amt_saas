"use server";

import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { clerkClient } from "@clerk/nextjs/server";

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

    console.log("Creating user:", { email, firstName, tenantId, role });

    // Validate inputs
    if (!email || !firstName || !password) {
        console.error("Validation failed: missing required fields");
        return { error: "Email, first name, and password are required" };
    }

    if (password.length < 8) {
        return { error: "Password must be at least 8 characters" };
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
    });

    if (!tenant) {
        return { error: "Tenant not found" };
    }

    // Check if user already exists in our DB for this tenant
    const existingUser = await db.user.findFirst({
        where: {
            email,
            tenantId,
        },
    });

    if (existingUser) {
        return { error: "A user with this email already exists in this tenant" };
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
        console.log("Clerk user created:", clerkUserId);
    } catch (error: unknown) {
        console.error("Error creating Clerk user:", JSON.stringify(error, null, 2));

        // Handle Clerk errors
        if (error && typeof error === "object" && "errors" in error) {
            const clerkError = error as { errors: Array<{ message: string; code: string; longMessage?: string }> };
            const firstError = clerkError.errors[0];
            console.error("Clerk error details:", firstError);
            return {
                error: firstError?.longMessage || firstError?.message || "Failed to create user in Clerk"
            };
        }

        return { error: "Failed to create user. Please try again." };
    }

    // Create user in our database (outside try-catch so redirect works)
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

    console.log("Database user created");

    // Revalidate
    revalidatePath(`/admin/tenants/${tenantId}`);

    // Redirect MUST be outside try-catch (it throws internally)
    redirect(`/admin/tenants/${tenantId}`);
}
