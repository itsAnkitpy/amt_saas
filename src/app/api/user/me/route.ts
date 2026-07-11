import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * GET /api/user/me
 *
 * Login bootstrap for any Bearer-token client (the mobile app): "who am I +
 * which workspace(s) can I act in". proxy.ts (clerkMiddleware) runs on /api/*
 * and authenticates the Authorization: Bearer <clerk token> the phone sends,
 * so no middleware change is needed here.
 *
 * Response shape mirrors amt-mobile lib/auth/types.ts UserMeResponse.
 */
export async function GET() {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            // proxy.ts normally blocks this; stay defensive.
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // User.id === Clerk user id (see seed.ts + webhooks/clerk).
        const user = await db.user.findUnique({
            where: { id: clerkUser.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isSuperAdmin: true,
                isActive: true,
                tenantId: true,
                tenant: { select: { id: true, name: true, slug: true, plan: true } },
            },
        });

        // Signed into Clerk but not provisioned in this app yet (or deactivated).
        if (!user || !user.isActive) {
            return NextResponse.json({ user: null, tenants: [], currentTenant: null });
        }

        const authUser = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            tenantId: user.tenantId,
        };

        // Superadmin has no home tenant → return all active tenants so the app's
        // select-tenant screen can list them; leave currentTenant null (they pick).
        if (user.isSuperAdmin) {
            const tenants = await db.tenant.findMany({
                where: { isActive: true },
                select: { id: true, name: true, slug: true, plan: true },
                orderBy: { name: "asc" },
            });
            return NextResponse.json({ user: authUser, tenants, currentTenant: null });
        }

        // Regular user: their single workspace (none → app shows no-access).
        const tenants = user.tenant ? [user.tenant] : [];
        return NextResponse.json({
            user: authUser,
            tenants,
            currentTenant: user.tenant ?? null,
        });
    } catch (error) {
        console.error("user/me error:", error);
        return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
    }
}
