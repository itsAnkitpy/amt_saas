import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusChart } from "@/components/dashboard/status-chart";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { ConditionChart } from "@/components/dashboard/condition-chart";
import { WarrantyAlert } from "@/components/dashboard/warranty-alert";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ActionCenterCard } from "@/components/dashboard/action-center-card";
import { QuickActionTile } from "@/components/dashboard/quick-action-tile";
import { addDays } from "date-fns";
import Link from "next/link";
import {
    AlertOctagon,
    AlertTriangle,
    ArchiveIcon,
    FolderKanban,
    PackagePlus,
    ScanLine,
    Users,
    Wrench,
} from "lucide-react";
import { hasRole } from "@/lib/auth";
import { getTenantMaintenanceAttentionSummary } from "@/lib/maintenance";

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

function buildAssetListHref(
    slug: string,
    filters: Record<string, string | undefined>
) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value) {
            params.set(key, value);
        }
    }

    const query = params.toString();
    return query ? `/t/${slug}/assets?${query}` : `/t/${slug}/assets`;
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

    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    // Get all stats and chart data in parallel for performance
    const [
        userCount,
        totalAssets,
        availableCount,
        assignedCount,
        maintenanceCount,
        maintenanceAttention,
        poorConditionCount,
        archivedAssetsCount,
        totalValueResult,
        statusDistribution,
        categoryBreakdown,
        conditionDistribution,
        warrantyExpiring,
        warrantyExpired,
        recentActivities,
    ] = await Promise.all([
        db.user.count({ where: { tenantId: tenant.id } }),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: null } }),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: null, status: "AVAILABLE" } }),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: null, status: "ASSIGNED" } }),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: null, status: "MAINTENANCE" } }),
        getTenantMaintenanceAttentionSummary(tenant.id, now),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: null, condition: "POOR" } }),
        db.asset.count({ where: { tenantId: tenant.id, archivedAt: { not: null } } }),
        db.asset.aggregate({
            where: { tenantId: tenant.id, archivedAt: null },
            _sum: { purchasePrice: true },
        }),
        // Status distribution for chart
        db.asset.groupBy({
            by: ["status"],
            where: { tenantId: tenant.id, archivedAt: null },
            _count: { status: true },
        }),
        // Category breakdown for chart
        db.asset.groupBy({
            by: ["categoryId"],
            where: { tenantId: tenant.id, archivedAt: null },
            _count: { categoryId: true },
        }),
        // Condition distribution for chart
        db.asset.groupBy({
            by: ["condition"],
            where: { tenantId: tenant.id, archivedAt: null },
            _count: { condition: true },
        }),
        // Warranty expiring in next 30 days
        db.asset.findMany({
            where: {
                tenantId: tenant.id,
                archivedAt: null,
                warrantyEnd: {
                    gte: now,
                    lte: thirtyDaysFromNow,
                },
            },
            select: {
                id: true,
                name: true,
                warrantyEnd: true,
            },
            orderBy: { warrantyEnd: "asc" },
        }),
        // Already expired warranties
        db.asset.findMany({
            where: {
                tenantId: tenant.id,
                archivedAt: null,
                warrantyEnd: {
                    lt: now,
                },
            },
            select: {
                id: true,
                name: true,
                warrantyEnd: true,
            },
            orderBy: { warrantyEnd: "desc" },
        }),
        // Recent activity (last 5)
        db.assetActivity.findMany({
            where: { tenantId: tenant.id },
            include: {
                asset: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
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

    // Transform warranty data
    const expiringWarrantyData = warrantyExpiring.map((asset) => ({
        id: asset.id,
        name: asset.name,
        warrantyEnd: asset.warrantyEnd!,
    }));

    const expiredWarrantyData = warrantyExpired.map((asset) => ({
        id: asset.id,
        name: asset.name,
        warrantyEnd: asset.warrantyEnd!,
    }));

    // Transform activity data
    const activityData = recentActivities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        createdAt: activity.createdAt,
        details: activity.details as Record<string, unknown> | null,
        asset: activity.asset,
    }));

    const {
        overdueCount: maintenanceOverdueCount,
        dueSoonCount: maintenanceDueSoonCount,
    } = maintenanceAttention;

    const isManager = hasRole(user, "MANAGER");
    const isAdmin = hasRole(user, "ADMIN");

    const actionCenterCards = [
        {
            title: "Maintenance Overdue",
            count: maintenanceOverdueCount,
            description: "These maintenance jobs are already overdue and should be handled first.",
            emptyMessage: "No maintenance jobs are currently overdue.",
            href: `/t/${slug}/maintenance?filter=overdue`,
            actionLabel: "Open overdue queue",
            icon: Wrench,
            tone: "red" as const,
        },
        {
            title: "Maintenance Due Soon",
            count: maintenanceDueSoonCount,
            description: "These scheduled jobs are due in the next 7 days and should be planned now.",
            emptyMessage: "No maintenance jobs are due in the next 7 days.",
            href: `/t/${slug}/maintenance?filter=due-soon`,
            actionLabel: "Plan upcoming work",
            icon: Wrench,
            tone: "blue" as const,
        },
        {
            title: "Expired Warranties",
            count: expiredWarrantyData.length,
            description: "These assets already lost warranty coverage and should be reviewed first.",
            emptyMessage: "No active assets currently have an expired warranty.",
            href: buildAssetListHref(slug, { warranty: "expired" }),
            actionLabel: "Review expired assets",
            icon: AlertOctagon,
            tone: "red" as const,
        },
        {
            title: "Expiring Soon",
            count: expiringWarrantyData.length,
            description: "These warranties expire in the next 30 days and may need renewal or replacement planning.",
            emptyMessage: "No warranties are expiring in the next 30 days.",
            href: buildAssetListHref(slug, { warranty: "expiring" }),
            actionLabel: "Review expiring assets",
            icon: AlertTriangle,
            tone: "amber" as const,
        },
        {
            title: "Poor Condition",
            count: poorConditionCount,
            description: "These assets are flagged as poor condition and likely need review, repair, or retirement.",
            emptyMessage: "No active assets are currently marked as poor condition.",
            href: buildAssetListHref(slug, { condition: "POOR" }),
            actionLabel: "Review condition risks",
            icon: AlertTriangle,
            tone: "orange" as const,
        },
        {
            title: "Archived Assets",
            count: archivedAssetsCount,
            description: "Use this view to restore archived assets or clean up older inventory decisions.",
            emptyMessage: "There are no archived assets waiting for follow-up.",
            href: buildAssetListHref(slug, { archived: "true" }),
            actionLabel: "Review archived inventory",
            icon: ArchiveIcon,
            tone: "zinc" as const,
        },
    ];

    const quickActions = [
        {
            title: "Maintenance Queue",
            description: "Work through overdue, due soon, and in-progress maintenance jobs.",
            href: `/t/${slug}/maintenance`,
            icon: Wrench,
        },
        {
            title: "View Inventory",
            description: "Open the full asset list and jump into filtering, exporting, and bulk operations.",
            href: `/t/${slug}/assets`,
            icon: FolderKanban,
        },
        {
            title: "Scan Asset",
            description: "Use the scanner to pull up an asset quickly from a QR code.",
            href: `/t/${slug}/scan`,
            icon: ScanLine,
        },
        {
            title: "Review Archived",
            description: "Check archived assets and restore anything that should be active again.",
            href: buildAssetListHref(slug, { archived: "true" }),
            icon: ArchiveIcon,
        },
        ...(isManager
            ? [
                {
                    title: "Add Asset",
                    description: "Create a new asset record and put it straight into inventory.",
                    href: `/t/${slug}/assets/new`,
                    icon: PackagePlus,
                },
            ]
            : []),
        ...(isAdmin
            ? [
                {
                    title: "Manage Team",
                    description: "Invite teammates, adjust roles, and keep tenant access organized.",
                    href: `/t/${slug}/users`,
                    icon: Users,
                },
                {
                    title: "Manage Categories",
                    description: "Update category structure and custom fields without leaving the workspace.",
                    href: `/t/${slug}/settings/categories`,
                    icon: FolderKanban,
                },
            ]
            : []),
    ];

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

            {/* Action Center */}
            <div className="mt-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                            Action Center
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Start here for the items most likely to need attention today.
                        </p>
                    </div>
                    <Link
                        href={`/t/${slug}/assets`}
                        className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                    >
                        Open full inventory
                    </Link>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    {actionCenterCards.map((card) => (
                        <ActionCenterCard
                            key={card.title}
                            title={card.title}
                            count={card.count}
                            description={card.description}
                            emptyMessage={card.emptyMessage}
                            href={card.href}
                            actionLabel={card.actionLabel}
                            icon={card.icon}
                            tone={card.tone}
                        />
                    ))}
                </div>
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

            {/* Condition Health & Warranty Alerts Row */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Condition Health */}
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                        Condition Health
                    </h3>
                    <ConditionChart data={conditionData} />
                </div>

                {/* Warranty Alerts */}
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold text-zinc-900 dark:text-white">
                        Warranty Alerts
                    </h3>
                    <WarrantyAlert
                        expiringAssets={expiringWarrantyData}
                        expiredAssets={expiredWarrantyData}
                        tenantSlug={slug}
                    />
                </div>
            </div>

            {/* Recent Activity Section */}
            <div className="mt-6">
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold text-zinc-900 dark:text-white">
                        Recent Activity
                    </h3>
                    <RecentActivity activities={activityData} tenantSlug={slug} />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Quick Actions
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Shortcuts for the workflows people use most often.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {quickActions.map((action) => (
                        <QuickActionTile
                            key={action.title}
                            title={action.title}
                            description={action.description}
                            href={action.href}
                            icon={action.icon}
                        />
                    ))}
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
