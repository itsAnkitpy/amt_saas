import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusChart } from "@/components/dashboard/status-chart";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { ConditionChart } from "@/components/dashboard/condition-chart";
import Link from "next/link";

interface TenantDashboardPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
}

/**
 * Tenant Dashboard Page
 * Shows overview stats and analytics for the tenant
 */
export default async function TenantDashboardPage({
    params,
}: TenantDashboardPageProps) {
    const { slug } = await params;
    const { user, tenant } = await requireTenantAccess(slug);

    // Get all stats and chart data in parallel for performance
    const [
        userCount,
        totalAssets,
        availableCount,
        assignedCount,
        maintenanceCount,
        totalValueResult,
        statusDistribution,
        categoryBreakdown,
        conditionDistribution,
    ] = await Promise.all([
        db.user.count({ where: { tenantId: tenant.id } }),
        db.asset.count({ where: { tenantId: tenant.id } }),
        db.asset.count({ where: { tenantId: tenant.id, status: "AVAILABLE" } }),
        db.asset.count({ where: { tenantId: tenant.id, status: "ASSIGNED" } }),
        db.asset.count({ where: { tenantId: tenant.id, status: "MAINTENANCE" } }),
        db.asset.aggregate({
            where: { tenantId: tenant.id },
            _sum: { purchasePrice: true },
        }),
        // Status distribution for chart
        db.asset.groupBy({
            by: ["status"],
            where: { tenantId: tenant.id },
            _count: { status: true },
        }),
        // Category breakdown for chart
        db.asset.groupBy({
            by: ["categoryId"],
            where: { tenantId: tenant.id },
            _count: { categoryId: true },
        }),
        // Condition distribution for chart
        db.asset.groupBy({
            by: ["condition"],
            where: { tenantId: tenant.id },
            _count: { condition: true },
        }),
    ]);

    // Fetch category names for the breakdown
    const categoryIds = categoryBreakdown.map((c) => c.categoryId);
    const categories = await db.assetCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const totalValue = totalValueResult._sum.purchasePrice?.toNumber() ?? 0;

    // Transform data for charts
    const statusData = statusDistribution.map((item) => ({
        status: item.status,
        count: item._count.status,
    }));

    const categoryData = categoryBreakdown
        .map((item) => ({
            name: categoryMap.get(item.categoryId) || "Unknown",
            count: item._count.categoryId,
        }))
        .sort((a, b) => b.count - a.count);

    const conditionData = conditionDistribution.map((item) => ({
        condition: item.condition,
        count: item._count.condition,
    }));

    return (
        <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Welcome back, {user.firstName}! Here&apos;s an overview of {tenant.name}.
            </p>

            {/* Primary Stats Grid */}
            <div className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                    title="Total Assets"
                    value={totalAssets}
                    iconName="package"
                    color="default"
                />
                <StatCard
                    title="Available"
                    value={availableCount}
                    iconName="check-circle"
                    color="green"
                />
                <StatCard
                    title="Assigned"
                    value={assignedCount}
                    iconName="user-check"
                    color="blue"
                />
                <StatCard
                    title="Maintenance"
                    value={maintenanceCount}
                    iconName="wrench"
                    color="amber"
                />
                <StatCard
                    title="Total Value"
                    value={formatCurrency(totalValue)}
                    iconName="dollar-sign"
                    color="violet"
                />
                <StatCard
                    title="Team Members"
                    value={userCount}
                    iconName="users"
                    color="default"
                />
            </div>

            {/* Charts Section */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                {/* Status Distribution Chart */}
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                        Status Distribution
                    </h3>
                    <StatusChart data={statusData} />
                </div>

                {/* Assets by Category Chart */}
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                        Assets by Category
                    </h3>
                    <CategoryChart data={categoryData} />
                </div>
            </div>

            {/* Condition Health Section */}
            <div className="mt-6">
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                        Condition Health
                    </h3>
                    <ConditionChart data={conditionData} />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <div className="mt-4 flex flex-wrap gap-4">
                    <Link
                        href={`/t/${slug}/assets`}
                        className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                        View Assets
                    </Link>
                    <Link
                        href={`/t/${slug}/scan`}
                        className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                        Scan Asset
                    </Link>
                    {(user.role === "ADMIN" || user.isSuperAdmin) && (
                        <Link
                            href={`/t/${slug}/users`}
                            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                        >
                            Manage Users
                        </Link>
                    )}
                </div>
            </div>

            {/* Plan Info */}
            <div className="mt-8 rounded-xl border bg-violet-50 p-6 dark:bg-violet-900/20">
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
