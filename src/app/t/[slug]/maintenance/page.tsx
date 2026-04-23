import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaintenanceJobActions } from "@/components/maintenance-job-actions";
import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMaintenanceDueSoonRange } from "@/lib/maintenance";

interface MaintenanceQueuePageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ filter?: string }>;
}

const FILTER_LABELS = {
    overdue: "Overdue",
    "due-soon": "Due Soon",
    "in-progress": "In Progress",
    open: "Open",
    completed: "Completed",
} as const;

type MaintenanceFilter = keyof typeof FILTER_LABELS;

function getFilterHref(slug: string, filter: MaintenanceFilter) {
    return `/t/${slug}/maintenance?filter=${filter}`;
}

function formatInterval(value: number, unit: string) {
    const label = unit.slice(0, -1).toLowerCase();
    return `Every ${value} ${label}${value === 1 ? "" : "s"}`;
}

export default async function MaintenanceQueuePage({
    params,
    searchParams,
}: MaintenanceQueuePageProps) {
    const { slug } = await params;
    const { filter } = await searchParams;
    const activeFilter: MaintenanceFilter =
        filter && filter in FILTER_LABELS
            ? (filter as MaintenanceFilter)
            : "open";
    const { tenant, user } = await requireTenantAccess(slug);
    const canManageMaintenance = hasRole(user, "MANAGER");
    const { start: todayStart, end: dueSoonEnd } = getMaintenanceDueSoonRange();

    const baseWhere = {
        asset: {
            tenantId: tenant.id,
            archivedAt: null,
        },
    } as const;

    const countsPromise = Promise.all([
        db.maintenanceJob.count({
            where: {
                ...baseWhere,
                status: "OPEN",
                dueAt: { lt: todayStart },
            },
        }),
        db.maintenanceJob.count({
            where: {
                ...baseWhere,
                status: "OPEN",
                dueAt: {
                    gte: todayStart,
                    lte: dueSoonEnd,
                },
            },
        }),
        db.maintenanceJob.count({
            where: {
                ...baseWhere,
                status: "IN_PROGRESS",
            },
        }),
        db.maintenanceJob.count({
            where: {
                ...baseWhere,
                status: "OPEN",
            },
        }),
        db.maintenanceJob.count({
            where: {
                ...baseWhere,
                status: "COMPLETED",
            },
        }),
    ]);

    const where =
        activeFilter === "overdue"
            ? {
                ...baseWhere,
                status: "OPEN" as const,
                dueAt: { lt: todayStart },
            }
            : activeFilter === "due-soon"
                ? {
                    ...baseWhere,
                    status: "OPEN" as const,
                    dueAt: {
                        gte: todayStart,
                        lte: dueSoonEnd,
                    },
                }
                : activeFilter === "in-progress"
                    ? {
                        ...baseWhere,
                        status: "IN_PROGRESS" as const,
                    }
                    : activeFilter === "completed"
                        ? {
                            ...baseWhere,
                            status: "COMPLETED" as const,
                        }
                        : {
                            ...baseWhere,
                            status: "OPEN" as const,
                        };

    const orderBy =
        activeFilter === "completed"
            ? [{ completedAt: "desc" as const }, { dueAt: "desc" as const }]
            : activeFilter === "in-progress"
                ? [{ startedAt: "desc" as const }, { dueAt: "asc" as const }]
                : [{ dueAt: "asc" as const }];

    const [counts, jobs] = await Promise.all([
        countsPromise,
        db.maintenanceJob.findMany({
            where,
            orderBy,
            include: {
                asset: {
                    select: {
                        id: true,
                        name: true,
                        assetTag: true,
                        location: true,
                        category: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                schedule: {
                    select: {
                        intervalValue: true,
                        intervalUnit: true,
                        instructions: true,
                    },
                },
            },
            take: 50,
        }),
    ]);

    const countMap: Record<MaintenanceFilter, number> = {
        overdue: counts[0],
        "due-soon": counts[1],
        "in-progress": counts[2],
        open: counts[3],
        completed: counts[4],
    };

    return (
        <div>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Maintenance</h2>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                        Review due work, track active jobs, and close recurring
                        maintenance from one queue.
                    </p>
                </div>
                <Link href={`/t/${slug}/assets`}>
                    <Button variant="outline">Back to assets</Button>
                </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-5">
                {(Object.keys(FILTER_LABELS) as MaintenanceFilter[]).map(
                    (filterKey) => {
                        const isActive = filterKey === activeFilter;

                        return (
                            <Link
                                key={filterKey}
                                href={getFilterHref(slug, filterKey)}
                                className={`rounded-xl border p-4 transition-colors ${
                                    isActive
                                        ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                                        : "bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                                }`}
                            >
                                <p className="text-sm font-medium">
                                    {FILTER_LABELS[filterKey]}
                                </p>
                                <p className="mt-2 text-2xl font-bold">
                                    {countMap[filterKey]}
                                </p>
                            </Link>
                        );
                    }
                )}
            </div>

            <div className="mt-6 rounded-xl border bg-white dark:bg-zinc-950">
                {jobs.length === 0 ? (
                    <div className="p-10 text-center text-sm text-zinc-500">
                        No jobs in the {FILTER_LABELS[activeFilter].toLowerCase()}{" "}
                        view right now.
                    </div>
                ) : (
                    <div className="divide-y">
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/t/${slug}/assets/${job.asset.id}`}
                                            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                                        >
                                            {job.asset.name}
                                        </Link>
                                        <Badge variant="outline">
                                            {job.asset.category.name}
                                        </Badge>
                                        <Badge variant="outline">{job.status}</Badge>
                                        {job.asset.assetTag && (
                                            <Badge variant="outline">
                                                {job.asset.assetTag}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="mt-2 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300 md:grid-cols-2 xl:grid-cols-4">
                                        <p>Due: {new Date(job.dueAt).toLocaleDateString()}</p>
                                        <p>
                                            Schedule:{" "}
                                            {formatInterval(
                                                job.schedule.intervalValue,
                                                job.schedule.intervalUnit
                                            )}
                                        </p>
                                        <p>
                                            Location: {job.asset.location || "—"}
                                        </p>
                                        <p>
                                            Completed by: {job.completedByName || "—"}
                                        </p>
                                    </div>

                                    {job.schedule.instructions && (
                                        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                                            {job.schedule.instructions}
                                        </p>
                                    )}

                                    {job.notes && (
                                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                            {job.notes}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col items-start gap-2 lg:items-end">
                                    {job.cost && (
                                        <Badge variant="outline">
                                            ₹{Number(job.cost).toLocaleString()}
                                        </Badge>
                                    )}
                                    <MaintenanceJobActions
                                        tenantSlug={slug}
                                        assetId={job.asset.id}
                                        job={{
                                            id: job.id,
                                            status: job.status,
                                        }}
                                        canManage={canManageMaintenance}
                                        compact
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
