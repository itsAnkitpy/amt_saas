import { addDays, addMonths, addWeeks, addYears, endOfDay } from "date-fns";
import { getTodayStart } from "@/lib/dates";
import {
    type AssetAction,
    type MaintenanceJobStatus,
    type MaintenanceIntervalUnit,
    type Prisma,
} from "@/generated/prisma";
import { db } from "@/lib/db";
import { logAssetActivity } from "@/lib/activity-log";

type MaintenanceDbClient = Pick<
    typeof db,
    "assetMaintenanceSchedule" | "maintenanceJob" | "assetActivity"
>;

interface MaintenanceActor {
    userId: string;
    userName: string;
    tenantId: string;
}

interface CreateMaintenanceScheduleParams extends MaintenanceActor {
    assetId: string;
    intervalValue: number;
    intervalUnit: MaintenanceIntervalUnit;
    firstDueAt: Date;
    instructions?: string | null;
    action?: Extract<AssetAction, "MAINTENANCE_SCHEDULED" | "MAINTENANCE_UPDATED">;
    details?: Record<string, unknown>;
}

interface DeactivateMaintenanceParams extends MaintenanceActor {
    assetIds: string[];
    reason: string;
    disabledAt?: Date;
    logCancelledActivity?: boolean;
    logDisabledActivity?: boolean;
}

export const MAINTENANCE_DUE_SOON_DAYS = 7;
export type MaintenanceAttentionState = "overdue" | "dueSoon" | "none";

type MaintenanceAttentionJob = {
    status: MaintenanceJobStatus | string;
    dueAt: Date;
};

type MaintenanceAttentionSummaryClient = Pick<typeof db, "maintenanceJob">;

export interface MaintenanceAttentionSummary {
    overdueCount: number;
    dueSoonCount: number;
    attentionCount: number;
}

export function addMaintenanceInterval(
    baseDate: Date,
    intervalValue: number,
    intervalUnit: MaintenanceIntervalUnit
) {
    switch (intervalUnit) {
        case "DAYS":
            return addDays(baseDate, intervalValue);
        case "WEEKS":
            return addWeeks(baseDate, intervalValue);
        case "MONTHS":
            return addMonths(baseDate, intervalValue);
        case "YEARS":
            return addYears(baseDate, intervalValue);
        default:
            return baseDate;
    }
}

export function formatMaintenanceInterval(
    intervalValue: number,
    intervalUnit: MaintenanceIntervalUnit
) {
    const singularLabels: Record<MaintenanceIntervalUnit, string> = {
        DAYS: "day",
        WEEKS: "week",
        MONTHS: "month",
        YEARS: "year",
    };

    const label = singularLabels[intervalUnit];
    return `Every ${intervalValue} ${label}${intervalValue === 1 ? "" : "s"}`;
}

export function getMaintenanceDueSoonRange(baseDate = new Date()) {
    const start = getTodayStart(baseDate);
    const end = endOfDay(addDays(start, MAINTENANCE_DUE_SOON_DAYS));

    return { start, end };
}

export function getMaintenanceAttentionState(
    job: MaintenanceAttentionJob | null | undefined,
    baseDate = new Date()
): MaintenanceAttentionState {
    if (!job || job.status !== "OPEN") {
        return "none";
    }

    const { start, end } = getMaintenanceDueSoonRange(baseDate);

    if (job.dueAt < start) {
        return "overdue";
    }

    if (job.dueAt <= end) {
        return "dueSoon";
    }

    return "none";
}

export async function getTenantMaintenanceAttentionSummary(
    tenantId: string,
    baseDate = new Date(),
    client: MaintenanceAttentionSummaryClient = db
): Promise<MaintenanceAttentionSummary> {
    const { start, end } = getMaintenanceDueSoonRange(baseDate);

    const [overdueCount, dueSoonCount] = await Promise.all([
        client.maintenanceJob.count({
            where: {
                asset: {
                    tenantId,
                    archivedAt: null,
                },
                status: "OPEN",
                dueAt: { lt: start },
            },
        }),
        client.maintenanceJob.count({
            where: {
                asset: {
                    tenantId,
                    archivedAt: null,
                },
                status: "OPEN",
                dueAt: {
                    gte: start,
                    lte: end,
                },
            },
        }),
    ]);

    return {
        overdueCount,
        dueSoonCount,
        attentionCount: overdueCount + dueSoonCount,
    };
}

export async function createMaintenanceScheduleWithFirstJob(
    params: CreateMaintenanceScheduleParams,
    client: MaintenanceDbClient = db
) {
    const schedule = await client.assetMaintenanceSchedule.create({
        data: {
            assetId: params.assetId,
            intervalValue: params.intervalValue,
            intervalUnit: params.intervalUnit,
            instructions: params.instructions ?? null,
            isActive: true,
        },
    });

    const job = await client.maintenanceJob.create({
        data: {
            assetId: params.assetId,
            scheduleId: schedule.id,
            status: "OPEN",
            dueAt: params.firstDueAt,
        },
    });

    await logAssetActivity(
        {
            action: params.action ?? "MAINTENANCE_SCHEDULED",
            assetId: params.assetId,
            userId: params.userId,
            userName: params.userName,
            tenantId: params.tenantId,
            details: {
                intervalValue: params.intervalValue,
                intervalUnit: params.intervalUnit,
                intervalLabel: formatMaintenanceInterval(
                    params.intervalValue,
                    params.intervalUnit
                ),
                dueAt: params.firstDueAt.toISOString(),
                instructions: params.instructions ?? null,
                ...params.details,
            },
        },
        client
    );

    return { schedule, job };
}

export async function cancelOpenMaintenanceJobsForScheduleIds(
    scheduleIds: string[],
    cancelledAt = new Date(),
    client: MaintenanceDbClient = db
) {
    if (scheduleIds.length === 0) {
        return [];
    }

    const jobs = await client.maintenanceJob.findMany({
        where: {
            scheduleId: { in: scheduleIds },
            status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        select: {
            id: true,
            assetId: true,
            status: true,
            dueAt: true,
        },
    });

    if (jobs.length === 0) {
        return [];
    }

    await client.maintenanceJob.updateMany({
        where: {
            id: { in: jobs.map((job) => job.id) },
        },
        data: {
            status: "CANCELLED",
            cancelledAt,
        },
    });

    return jobs;
}

export async function deactivateMaintenanceForAssets(
    params: DeactivateMaintenanceParams,
    client: MaintenanceDbClient = db
) {
    if (params.assetIds.length === 0) {
        return {
            hadSchedule: false,
            activeScheduleCount: 0,
            cancelledJobCount: 0,
        };
    }

    const disabledAt = params.disabledAt ?? new Date();
    const schedules = await client.assetMaintenanceSchedule.findMany({
        where: {
            assetId: { in: params.assetIds },
        },
        select: {
            id: true,
            assetId: true,
            isActive: true,
        },
    });

    if (schedules.length === 0) {
        return {
            hadSchedule: false,
            activeScheduleCount: 0,
            cancelledJobCount: 0,
        };
    }

    const activeSchedules = schedules.filter((schedule) => schedule.isActive);
    if (activeSchedules.length > 0) {
        await client.assetMaintenanceSchedule.updateMany({
            where: {
                id: { in: activeSchedules.map((schedule) => schedule.id) },
            },
            data: {
                isActive: false,
            },
        });
    }

    const cancelledJobs = await cancelOpenMaintenanceJobsForScheduleIds(
        schedules.map((schedule) => schedule.id),
        disabledAt,
        client
    );

    if (params.logDisabledActivity !== false && activeSchedules.length > 0) {
        await client.assetActivity.createMany({
            data: activeSchedules.map((schedule) => ({
                action: "MAINTENANCE_DISABLED",
                assetId: schedule.assetId,
                userId: params.userId,
                tenantId: params.tenantId,
                details: {
                    performedBy: params.userName,
                    reason: params.reason,
                    disabledAt: disabledAt.toISOString(),
                } satisfies Prisma.InputJsonValue,
            })),
        });
    }

    if (params.logCancelledActivity !== false && cancelledJobs.length > 0) {
        const jobsByAsset = cancelledJobs.reduce<
            Map<
                string,
                {
                    jobCount: number;
                    dueAt: string[];
                }
            >
        >((map, job) => {
            const existing = map.get(job.assetId) ?? { jobCount: 0, dueAt: [] };
            existing.jobCount += 1;
            existing.dueAt.push(job.dueAt.toISOString());
            map.set(job.assetId, existing);
            return map;
        }, new Map());

        await client.assetActivity.createMany({
            data: Array.from(jobsByAsset.entries()).map(([assetId, value]) => ({
                action: "MAINTENANCE_CANCELLED",
                assetId,
                userId: params.userId,
                tenantId: params.tenantId,
                details: {
                    performedBy: params.userName,
                    reason: params.reason,
                    cancelledAt: disabledAt.toISOString(),
                    cancelledJobs: value.jobCount,
                    dueAt: value.dueAt,
                } satisfies Prisma.InputJsonValue,
            })),
        });
    }

    return {
        hadSchedule: true,
        activeScheduleCount: activeSchedules.length,
        cancelledJobCount: cancelledJobs.length,
    };
}
