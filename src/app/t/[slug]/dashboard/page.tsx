import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";

interface TenantDashboardPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Tenant Dashboard Page
 * Shows overview stats for the tenant
 */
export default async function TenantDashboardPage({
    params,
}: TenantDashboardPageProps) {
    const { slug } = await params;
    const { user, tenant } = await requireTenantAccess(slug);

    // Get stats for this tenant
    const [userCount, assetCount, availableAssets, assignedAssets] =
        await Promise.all([
            db.user.count({ where: { tenantId: tenant.id } }),
            db.asset.count({ where: { tenantId: tenant.id } }),
            db.asset.count({ where: { tenantId: tenant.id, status: "AVAILABLE" } }),
            db.asset.count({ where: { tenantId: tenant.id, status: "ASSIGNED" } }),
        ]);

    return (
        <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="mt-2 text-zinc-600">
                Welcome back, {user.firstName}! Here&apos;s an overview of {tenant.name}.
            </p>

            {/* Stats Grid */}
            <div className="mt-8 grid gap-6 md:grid-cols-4">
                {/* Users Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Team Members</p>
                    <p className="mt-2 text-4xl font-bold text-violet-600">{userCount}</p>
                </div>

                {/* Total Assets Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Total Assets</p>
                    <p className="mt-2 text-4xl font-bold">{assetCount}</p>
                </div>

                {/* Available Assets Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Available</p>
                    <p className="mt-2 text-4xl font-bold text-green-600">
                        {availableAssets}
                    </p>
                </div>

                {/* Assigned Assets Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Assigned</p>
                    <p className="mt-2 text-4xl font-bold text-blue-600">
                        {assignedAssets}
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <div className="mt-4 flex gap-4">
                    <a
                        href={`/t/${slug}/assets`}
                        className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                        View Assets
                    </a>
                    {(user.role === "ADMIN" || user.isSuperAdmin) && (
                        <a
                            href={`/t/${slug}/users`}
                            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                        >
                            Manage Users
                        </a>
                    )}
                </div>
            </div>

            {/* Plan Info */}
            <div className="mt-8 rounded-lg border bg-violet-50 p-6 dark:bg-violet-900/20">
                <h3 className="font-semibold text-violet-900 dark:text-violet-100">
                    Current Plan: {tenant.plan}
                </h3>
                <p className="mt-2 text-sm text-violet-700 dark:text-violet-300">
                    {tenant.plan === "FREE"
                        ? "Upgrade to unlock more features and team members."
                        : "Thank you for being a valued customer!"}
                </p>
            </div>
        </div>
    );
}
