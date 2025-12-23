import { db } from "@/lib/db";

/**
 * Admin Dashboard Page
 * Shows overview stats for the superadmin
 */
export default async function AdminDashboardPage() {
    // Get stats
    const [tenantCount, userCount, assetCount] = await Promise.all([
        db.tenant.count(),
        db.user.count(),
        db.asset.count(),
    ]);

    return (
        <div>
            <h2 className="text-2xl font-bold">Admin Dashboard</h2>
            <p className="mt-2 text-zinc-600">
                Welcome to the super admin panel. Manage all tenants and users from here.
            </p>

            {/* Stats Grid */}
            <div className="mt-8 grid gap-6 md:grid-cols-3">
                {/* Tenants Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Total Tenants</p>
                    <p className="mt-2 text-4xl font-bold">{tenantCount}</p>
                </div>

                {/* Users Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Total Users</p>
                    <p className="mt-2 text-4xl font-bold">{userCount}</p>
                </div>

                {/* Assets Card */}
                <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Total Assets</p>
                    <p className="mt-2 text-4xl font-bold">{assetCount}</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <div className="mt-4 flex gap-4">
                    <a
                        href="/admin/tenants/new"
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                        + Create Tenant
                    </a>
                </div>
            </div>
        </div>
    );
}
