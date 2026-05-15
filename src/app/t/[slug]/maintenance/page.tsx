import Link from "next/link";
import {
    AlertTriangleIcon,
    CalendarClockIcon,
    CheckCircle2Icon,
    Clock3Icon,
    PlayCircleIcon,
} from "lucide-react";
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

const FILTER_DESCRIPTIONS: Record<MaintenanceFilter, string> = {
    overdue: "Late work",
    "due-soon": "Next 7 days",
    "in-progress": "Being handled",
    open: "All waiting jobs",
    completed: "Recently closed",
};

const FILTER_CLASSES: Record<MaintenanceFilter, { active: string; inactive: string }> = {
    overdue: {
        active: "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
        inactive: "bg-white hover:border-red-200 hover:bg-red-50/60 dark:bg-zinc-950 dark:hover:bg-red-950/20",
    },
    "due-soon": {
        active: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
        inactive: "bg-white hover:border-amber-200 hover:bg-amber-50/60 dark:bg-zinc-950 dark:hover:bg-amber-950/20",
    },
    "in-progress": {
        active: "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
        inactive: "bg-white hover:border-blue-200 hover:bg-blue-50/60 dark:bg-zinc-950 dark:hover:bg-blue-950/20",
    },
    open: {
        active: "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
        inactive: "bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900",
    },
    completed: {
        active: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
        inactive: "bg-white hover:border-emerald-200 hover:bg-emerald-50/60 dark:bg-zinc-950 dark:hover:bg-emerald-950/20",
    },
};

function getFilterHref(slug: string, filter: MaintenanceFilter) {
    return `/t/${slug}/maintenance?filter=${filter}`;
}

function formatInterval(value: number, unit: string) {
    const label = unit.slice(0, -1).toLowerCase();
    return `Every ${value} ${label}${value === 1 ? "" : "s"}`;
}

function formatDate(value: Date | null) {
    return value ? value.toLocaleDateString() : "—";
}

function formatDueDistance(value: Date) {
    const dueDate = new Date(value);
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const dayDiff = Math.round(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff < 0) {
        const days = Math.abs(dayDiff);
        return `${days} day${days === 1 ? "" : "s"} overdue`;
    }

    if (dayDiff === 0) return "Due today";
    if (dayDiff === 1) return "Due tomorrow";

    return `Due in ${dayDiff} days`;
}

function getJobState(job: {
    status: string;
    dueAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
}) {
    if (job.status === "COMPLETED") {
        return {
            label: "Completed",
            description: `Closed ${formatDate(job.completedAt)}`,
            icon: CheckCircle2Icon,
            badgeClass:
                "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
            rowClass:
                "border-l-4 border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10",
        };
    }

    if (job.status === "IN_PROGRESS") {
        return {
            label: "In progress",
            description: job.startedAt
                ? `Started ${formatDate(job.startedAt)}`
                : "Work has started",
            icon: PlayCircleIcon,
            badgeClass:
                "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
            rowClass:
                "border-l-4 border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10",
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoon = new Date(today);
    dueSoon.setDate(today.getDate() + 7);
    dueSoon.setHours(23, 59, 59, 999);

    if (job.dueAt < today) {
        return {
            label: "Overdue",
            description: formatDueDistance(job.dueAt),
            icon: AlertTriangleIcon,
            badgeClass:
                "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
            rowClass:
                "border-l-4 border-l-red-400 bg-red-50/40 dark:bg-red-950/10",
        };
    }

    if (job.dueAt <= dueSoon) {
        return {
            label: "Due soon",
            description: formatDueDistance(job.dueAt),
            icon: Clock3Icon,
            badgeClass:
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
            rowClass:
                "border-l-4 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/10",
        };
    }

    return {
        label: "Open",
        description: formatDueDistance(job.dueAt),
        icon: CalendarClockIcon,
        badgeClass:
            "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
        rowClass: "border-l-4 border-l-zinc-200",
    };
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
    const attentionCount =
        countMap.overdue + countMap["due-soon"] + countMap["in-progress"];

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

            <div
                className={
                    attentionCount > 0
                        ? "mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
                        : "mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100"
                }
            >
                <div className="flex items-start gap-3">
                    {attentionCount > 0 ? (
                        <AlertTriangleIcon className="mt-0.5 h-5 w-5" />
                    ) : (
                        <CheckCircle2Icon className="mt-0.5 h-5 w-5" />
                    )}
                    <div>
                        <p className="font-medium">
                            {attentionCount > 0
                                ? `${attentionCount} maintenance job${attentionCount === 1 ? "" : "s"} need attention`
                                : "Maintenance queue is calm"}
                        </p>
                        <p className="mt-1 text-sm opacity-80">
                            {attentionCount > 0
                                ? "Handle overdue work first, then due-soon and in-progress jobs."
                                : "No overdue, due-soon, or in-progress jobs right now."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-5">
                {(Object.keys(FILTER_LABELS) as MaintenanceFilter[]).map(
                    (filterKey) => {
                        const isActive = filterKey === activeFilter;
                        const classes = FILTER_CLASSES[filterKey];

                        return (
                            <Link
                                key={filterKey}
                                href={getFilterHref(slug, filterKey)}
                                className={`rounded-xl border p-4 transition-colors ${
                                    isActive ? classes.active : classes.inactive
                                }`}
                            >
                                <p className="text-sm font-medium">
                                    {FILTER_LABELS[filterKey]}
                                </p>
                                <p className="mt-1 text-xs opacity-70">
                                    {FILTER_DESCRIPTIONS[filterKey]}
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
                    <div className="p-10 text-center">
                        <CheckCircle2Icon className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-3 font-medium">
                            No {FILTER_LABELS[activeFilter].toLowerCase()} jobs
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                            {activeFilter === "overdue"
                                ? "Nothing is late. Tiny victory, very civilized."
                                : activeFilter === "due-soon"
                                    ? "Nothing is due in the next 7 days."
                                    : activeFilter === "in-progress"
                                        ? "No jobs are currently being worked on."
                                        : activeFilter === "completed"
                                            ? "Completed maintenance will appear here."
                                            : "No open jobs are waiting right now."}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {jobs.map((job) => {
                            const jobState = getJobState(job);
                            const JobStateIcon = jobState.icon;

                            return (
                                <div
                                    key={job.id}
                                    className={`flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between ${jobState.rowClass}`}
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
                                            <Badge className={jobState.badgeClass}>
                                                <JobStateIcon className="h-3.5 w-3.5" />
                                                {jobState.label}
                                            </Badge>
                                            {job.asset.assetTag && (
                                                <Badge variant="outline">
                                                    {job.asset.assetTag}
                                                </Badge>
                                            )}
                                        </div>

                                        <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                            {jobState.description}
                                        </p>

                                        <div className="mt-2 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300 md:grid-cols-2 xl:grid-cols-4">
                                            <p>Due: {formatDate(job.dueAt)}</p>
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
                                            <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-300">
                                                {job.schedule.instructions}
                                            </p>
                                        )}

                                        {job.notes && (
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
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
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
