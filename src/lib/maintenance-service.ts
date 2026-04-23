import { Prisma } from "@/generated/prisma";
import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserDisplayName, logAssetActivity } from "@/lib/activity-log";
import { badRequest, notFound } from "@/lib/api-error";
import {
    addMaintenanceInterval,
    cancelOpenMaintenanceJobsForScheduleIds,
    createMaintenanceScheduleWithFirstJob,
    deactivateMaintenanceForAssets,
    formatMaintenanceInterval,
} from "@/lib/maintenance";
import {
    CompleteMaintenanceJobSchema,
    MaintenanceScheduleInputSchema,
    StartMaintenanceJobSchema,
    validate,
} from "@/lib/validations";

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

async function requireMaintenanceManagerContext(tenantSlug: string) {
    const context = await requireTenantAccess(tenantSlug);

    if (!hasRole(context.user, "MANAGER")) {
        throw new Error("You need MANAGER role or higher to manage maintenance");
    }

    return context;
}

function assertAssetSupportsMaintenance(asset: {
    archivedAt: Date | null;
    maintenanceSchedule?: { id: string; isActive: boolean } | null;
}) {
    if (asset.archivedAt) {
        throw badRequest("Archived assets cannot be modified");
    }

    if (!asset.maintenanceSchedule) {
        throw badRequest("Maintenance is not configured for this asset");
    }

    if (!asset.maintenanceSchedule.isActive) {
        throw badRequest("Maintenance is not currently active for this asset");
    }
}

function validateScheduleInput(input: unknown) {
    const result = validate(MaintenanceScheduleInputSchema, input);
    if (!result.success) {
        throw badRequest(result.error);
    }

    return result.data;
}

function validateStartInput(input: unknown) {
    const result = validate(StartMaintenanceJobSchema, input);
    if (!result.success) {
        throw badRequest(result.error);
    }

    return result.data;
}

function validateCompleteInput(input: unknown) {
    const result = validate(CompleteMaintenanceJobSchema, input);
    if (!result.success) {
        throw badRequest(result.error);
    }

    return result.data;
}

export async function upsertMaintenanceScheduleForAsset(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    const { tenant, user } = await requireMaintenanceManagerContext(tenantSlug);
    const validatedInput = validateScheduleInput(input);
    const userName = getUserDisplayName(user);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                archivedAt: true,
                maintenanceSchedule: {
                    select: {
                        id: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        if (asset.archivedAt) {
            throw badRequest("Archived assets cannot be modified");
        }

        const existingSchedule = asset.maintenanceSchedule;

        if (!existingSchedule) {
            return createMaintenanceScheduleWithFirstJob(
                {
                    assetId: asset.id,
                    intervalValue: validatedInput.intervalValue,
                    intervalUnit: validatedInput.intervalUnit,
                    firstDueAt: validatedInput.firstDueAt,
                    instructions: validatedInput.instructions ?? null,
                    userId: user.id,
                    userName,
                    tenantId: tenant.id,
                },
                tx
            );
        }

        const updatedAt = new Date();
        const cancelledJobs = await cancelOpenMaintenanceJobsForScheduleIds(
            [existingSchedule.id],
            updatedAt,
            tx
        );

        const schedule = await tx.assetMaintenanceSchedule.update({
            where: {
                id: existingSchedule.id,
            },
            data: {
                intervalValue: validatedInput.intervalValue,
                intervalUnit: validatedInput.intervalUnit,
                instructions: validatedInput.instructions ?? null,
                isActive: true,
            },
        });

        const job = await tx.maintenanceJob.create({
            data: {
                assetId: asset.id,
                scheduleId: schedule.id,
                status: "OPEN",
                dueAt: validatedInput.firstDueAt,
            },
        });

        await logAssetActivity(
            {
                action: "MAINTENANCE_UPDATED",
                assetId: asset.id,
                userId: user.id,
                userName,
                tenantId: tenant.id,
                details: {
                    intervalValue: validatedInput.intervalValue,
                    intervalUnit: validatedInput.intervalUnit,
                    intervalLabel: formatMaintenanceInterval(
                        validatedInput.intervalValue,
                        validatedInput.intervalUnit
                    ),
                    dueAt: validatedInput.firstDueAt.toISOString(),
                    instructions: validatedInput.instructions ?? null,
                    resetOpenJobs: cancelledJobs.length,
                    reactivated: !existingSchedule.isActive,
                    updatedAt: updatedAt.toISOString(),
                },
            },
            tx
        );

        return { schedule, job };
    });
}

export async function disableMaintenanceScheduleForAsset(
    tenantSlug: string,
    assetId: string
) {
    const { tenant, user } = await requireMaintenanceManagerContext(tenantSlug);
    const userName = getUserDisplayName(user);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                archivedAt: true,
                maintenanceSchedule: {
                    select: {
                        id: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetSupportsMaintenance(asset);

        return deactivateMaintenanceForAssets(
            {
                assetIds: [asset.id],
                reason: "manual_disable",
                userId: user.id,
                userName,
                tenantId: tenant.id,
            },
            tx
        );
    });
}

export async function startMaintenanceJobForAsset(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    const { tenant, user } = await requireMaintenanceManagerContext(tenantSlug);
    const validatedInput = validateStartInput(input);
    const userName = getUserDisplayName(user);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                archivedAt: true,
                maintenanceSchedule: {
                    select: {
                        id: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetSupportsMaintenance(asset);
        const maintenanceSchedule = asset.maintenanceSchedule;
        if (!maintenanceSchedule) {
            throw badRequest("Maintenance is not configured for this asset");
        }

        const job = await tx.maintenanceJob.findFirst({
            where: {
                id: validatedInput.jobId,
                assetId: asset.id,
                scheduleId: maintenanceSchedule.id,
            },
            select: {
                id: true,
                status: true,
                dueAt: true,
                startedAt: true,
            },
        });

        if (!job) {
            throw notFound("Maintenance job not found");
        }

        if (job.status !== "OPEN") {
            throw badRequest("Only open maintenance jobs can be started");
        }

        const startedAt = new Date();
        const updatedJob = await tx.maintenanceJob.update({
            where: {
                id: job.id,
            },
            data: {
                status: "IN_PROGRESS",
                startedAt,
            },
        });

        await logAssetActivity(
            {
                action: "MAINTENANCE_STARTED",
                assetId: asset.id,
                userId: user.id,
                userName,
                tenantId: tenant.id,
                details: {
                    jobId: job.id,
                    dueAt: job.dueAt.toISOString(),
                    startedAt: startedAt.toISOString(),
                },
            },
            tx
        );

        return updatedJob;
    });
}

export async function completeMaintenanceJobForAsset(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    const { tenant, user } = await requireMaintenanceManagerContext(tenantSlug);
    const validatedInput = validateCompleteInput(input);
    const userName = getUserDisplayName(user);

    return db.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
            where: {
                id: assetId,
                tenantId: tenant.id,
            },
            select: {
                id: true,
                archivedAt: true,
                maintenanceSchedule: {
                    select: {
                        id: true,
                        isActive: true,
                        intervalValue: true,
                        intervalUnit: true,
                    },
                },
            },
        });

        if (!asset) {
            throw notFound("Asset not found");
        }

        assertAssetSupportsMaintenance(asset);
        const maintenanceSchedule = asset.maintenanceSchedule;
        if (!maintenanceSchedule) {
            throw badRequest("Maintenance is not configured for this asset");
        }

        const job = await tx.maintenanceJob.findFirst({
            where: {
                id: validatedInput.jobId,
                assetId: asset.id,
                scheduleId: maintenanceSchedule.id,
            },
            select: {
                id: true,
                status: true,
                dueAt: true,
                startedAt: true,
            },
        });

        if (!job) {
            throw notFound("Maintenance job not found");
        }

        if (!["OPEN", "IN_PROGRESS"].includes(job.status)) {
            throw badRequest(
                "Only open or in-progress maintenance jobs can be completed"
            );
        }

        const completedAt = new Date();
        const nextDueAt = addMaintenanceInterval(
            completedAt,
            maintenanceSchedule.intervalValue,
            maintenanceSchedule.intervalUnit
        );

        const completedJob = await tx.maintenanceJob.update({
            where: {
                id: job.id,
            },
            data: {
                status: "COMPLETED",
                startedAt: job.startedAt ?? completedAt,
                completedAt,
                cancelledAt: null,
                notes: validatedInput.notes ?? null,
                cost:
                    validatedInput.cost === null || validatedInput.cost === undefined
                        ? null
                        : new Prisma.Decimal(validatedInput.cost),
                completedById: user.id,
                completedByName: userName,
            },
        });

        const nextJob = await tx.maintenanceJob.create({
            data: {
                assetId: asset.id,
                scheduleId: maintenanceSchedule.id,
                status: "OPEN",
                dueAt: nextDueAt,
            },
        });

        await logAssetActivity(
            {
                action: "MAINTENANCE_COMPLETED",
                assetId: asset.id,
                userId: user.id,
                userName,
                tenantId: tenant.id,
                details: {
                    jobId: job.id,
                    dueAt: job.dueAt.toISOString(),
                    completedAt: completedAt.toISOString(),
                    nextDueAt: nextDueAt.toISOString(),
                    cost:
                        validatedInput.cost === null || validatedInput.cost === undefined
                            ? null
                            : validatedInput.cost,
                    notesProvided: Boolean(validatedInput.notes),
                },
            },
            tx
        );

        return {
            completedJob,
            nextJob,
        };
    });
}

export function getMaintenanceServiceErrorMessage(
    error: unknown,
    fallback: string
) {
    return getErrorMessage(error, fallback);
}
