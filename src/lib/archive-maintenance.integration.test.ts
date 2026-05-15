import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { archiveAssetWithContext } = require(
    "./asset-service.ts"
) as typeof import("./asset-service");

type ArchiveAssetClient = Parameters<typeof archiveAssetWithContext>[1];

// End-to-end coverage for the archive -> maintenance cleanup contract.
//
// The system has two paths that must produce the same outcome on schedules
// and jobs when an asset is archived:
//
//   1. The service path: archiveAssetWithContext() -> deactivateMaintenanceForAssets()
//      writes MAINTENANCE_DISABLED / MAINTENANCE_CANCELLED / DELETED activity rows.
//   2. The data-layer safety net: a raw UPDATE of assets.archivedAt fires the
//      Postgres trigger defined in
//      prisma/migrations/20260514130000_harden_archive_maintenance_cleanup/migration.sql
//      which cancels open jobs and deactivates schedules but does NOT audit-log
//      (audit is the caller's responsibility).
//
// These tests run the real archiveAssetWithContext, the real
// deactivateMaintenanceForAssets, and the real logAssetActivity against an
// in-memory fake Prisma client whose `asset.update` emulates the trigger.

type JobStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type AssetRow = {
    id: string;
    tenantId: string;
    name: string;
    status: string;
    assignedToId: string | null;
    archivedAt: Date | null;
};

type ScheduleRow = {
    id: string;
    assetId: string;
    isActive: boolean;
};

type JobRow = {
    id: string;
    assetId: string;
    scheduleId: string;
    status: JobStatus;
    dueAt: Date;
    cancelledAt: Date | null;
};

type ActivityRow = {
    id: string;
    action: string;
    assetId: string;
    userId: string;
    tenantId: string;
    details: Record<string, unknown>;
};

const tenantId = "tenant_integration";
const managerUser = {
    id: "user_manager",
    firstName: "Alex",
    lastName: "Morgan",
} as const;

function buildSeed() {
    return {
        asset: {
            id: "asset_1",
            tenantId,
            name: "MacBook Pro 16",
            status: "AVAILABLE",
            assignedToId: null,
            archivedAt: null,
        } satisfies AssetRow,
        schedule: {
            id: "sched_1",
            assetId: "asset_1",
            isActive: true,
        } satisfies ScheduleRow,
        jobs: [
            {
                id: "job_open",
                assetId: "asset_1",
                scheduleId: "sched_1",
                status: "OPEN",
                dueAt: new Date("2026-06-01T00:00:00.000Z"),
                cancelledAt: null,
            },
            {
                id: "job_in_progress",
                assetId: "asset_1",
                scheduleId: "sched_1",
                status: "IN_PROGRESS",
                dueAt: new Date("2026-05-15T00:00:00.000Z"),
                cancelledAt: null,
            },
            {
                id: "job_completed",
                assetId: "asset_1",
                scheduleId: "sched_1",
                status: "COMPLETED",
                dueAt: new Date("2026-04-01T00:00:00.000Z"),
                cancelledAt: null,
            },
        ] satisfies JobRow[],
    };
}

function createFakeDb(seed: ReturnType<typeof buildSeed>) {
    const assets = new Map<string, AssetRow>([[seed.asset.id, { ...seed.asset }]]);
    const schedules = new Map<string, ScheduleRow>([
        [seed.schedule.id, { ...seed.schedule }],
    ]);
    const jobs = new Map<string, JobRow>(
        seed.jobs.map((job) => [job.id, { ...job }])
    );
    const activities: ActivityRow[] = [];
    let triggerFireCount = 0;

    // Mirrors the trigger from
    // prisma/migrations/20260514130000_harden_archive_maintenance_cleanup/migration.sql:
    //   AFTER UPDATE OF "archivedAt" ON "assets"
    //   WHEN OLD."archivedAt" IS NULL AND NEW."archivedAt" IS NOT NULL
    function fireArchiveTriggerIfApplicable(
        assetId: string,
        previousArchivedAt: Date | null,
        nextArchivedAt: Date | null
    ) {
        if (previousArchivedAt !== null || nextArchivedAt === null) {
            return;
        }

        triggerFireCount += 1;

        for (const schedule of schedules.values()) {
            if (schedule.assetId === assetId && schedule.isActive) {
                schedule.isActive = false;
            }
        }

        for (const job of jobs.values()) {
            if (
                job.assetId === assetId &&
                (job.status === "OPEN" || job.status === "IN_PROGRESS")
            ) {
                job.status = "CANCELLED";
                job.cancelledAt = nextArchivedAt;
            }
        }
    }

    const client = {
        asset: {
            async findFirst(args: {
                where: { id: string; tenantId: string };
            }) {
                const row = assets.get(args.where.id);
                if (!row || row.tenantId !== args.where.tenantId) {
                    return null;
                }
                return { ...row };
            },
            async update(args: {
                where: { id: string };
                data: Partial<AssetRow>;
            }) {
                const row = assets.get(args.where.id);
                if (!row) {
                    throw new Error(
                        `Asset ${args.where.id} not found in fake db`
                    );
                }

                const previousArchivedAt = row.archivedAt;
                Object.assign(row, args.data);
                fireArchiveTriggerIfApplicable(
                    row.id,
                    previousArchivedAt,
                    row.archivedAt
                );
                return { ...row };
            },
        },
        assetMaintenanceSchedule: {
            async findMany(args: {
                where: { assetId: { in: string[] } };
                select?: Record<string, boolean>;
            }) {
                const assetIds = args.where.assetId.in;
                return [...schedules.values()]
                    .filter((schedule) => assetIds.includes(schedule.assetId))
                    .map((schedule) => ({ ...schedule }));
            },
            async updateMany(args: {
                where: { id: { in: string[] } };
                data: Partial<ScheduleRow>;
            }) {
                const ids = new Set(args.where.id.in);
                let count = 0;
                for (const schedule of schedules.values()) {
                    if (ids.has(schedule.id)) {
                        Object.assign(schedule, args.data);
                        count += 1;
                    }
                }
                return { count };
            },
        },
        maintenanceJob: {
            async findMany(args: {
                where: {
                    scheduleId: { in: string[] };
                    status: { in: JobStatus[] };
                };
                select?: Record<string, boolean>;
            }) {
                const scheduleIds = new Set(args.where.scheduleId.in);
                const statuses = new Set(args.where.status.in);
                return [...jobs.values()]
                    .filter(
                        (job) =>
                            scheduleIds.has(job.scheduleId) &&
                            statuses.has(job.status)
                    )
                    .map((job) => ({ ...job }));
            },
            async updateMany(args: {
                where: { id: { in: string[] } };
                data: Partial<JobRow>;
            }) {
                const ids = new Set(args.where.id.in);
                let count = 0;
                for (const job of jobs.values()) {
                    if (ids.has(job.id)) {
                        Object.assign(job, args.data);
                        count += 1;
                    }
                }
                return { count };
            },
        },
        assetActivity: {
            async create(args: {
                data: Omit<ActivityRow, "id"> & {
                    details?: Record<string, unknown>;
                };
            }) {
                const row: ActivityRow = {
                    id: `activity_${activities.length + 1}`,
                    action: args.data.action,
                    assetId: args.data.assetId,
                    userId: args.data.userId,
                    tenantId: args.data.tenantId,
                    details: args.data.details ?? {},
                };
                activities.push(row);
                return row;
            },
            async createMany(args: {
                data: Array<Omit<ActivityRow, "id">>;
            }) {
                for (const entry of args.data) {
                    activities.push({
                        id: `activity_${activities.length + 1}`,
                        action: entry.action,
                        assetId: entry.assetId,
                        userId: entry.userId,
                        tenantId: entry.tenantId,
                        details: entry.details ?? {},
                    });
                }
                return { count: args.data.length };
            },
        },
    };

    return {
        client,
        getAsset: (id: string) => assets.get(id),
        getSchedule: (id: string) => schedules.get(id),
        getJob: (id: string) => jobs.get(id),
        activities,
        getTriggerFireCount: () => triggerFireCount,
    };
}

// The trigger's contract covers only the maintenance side: schedules become
// inactive and open/in-progress jobs become cancelled. It does not normalize
// assets.status -- that remains the application layer's responsibility.
function maintenanceFingerprint(db: ReturnType<typeof createFakeDb>) {
    return {
        assetArchived: db.getAsset("asset_1")?.archivedAt !== null,
        scheduleActive: db.getSchedule("sched_1")?.isActive,
        jobStatuses: {
            open: db.getJob("job_open")?.status,
            inProgress: db.getJob("job_in_progress")?.status,
            completed: db.getJob("job_completed")?.status,
        },
    };
}

test("service archive path disables schedule, cancels OPEN and IN_PROGRESS jobs, leaves COMPLETED untouched, and writes audit rows", async () => {
    const db = createFakeDb(buildSeed());

    await archiveAssetWithContext(
        { assetId: "asset_1", tenantId, user: managerUser },
        db.client as unknown as ArchiveAssetClient
    );

    const asset = db.getAsset("asset_1");
    assert.ok(asset);
    assert.equal(asset.status, "RETIRED");
    assert.ok(asset.archivedAt instanceof Date);

    assert.equal(db.getSchedule("sched_1")?.isActive, false);
    assert.equal(db.getJob("job_open")?.status, "CANCELLED");
    assert.equal(db.getJob("job_in_progress")?.status, "CANCELLED");
    assert.equal(db.getJob("job_completed")?.status, "COMPLETED");

    assert.deepEqual(
        db.activities.map((row) => row.action),
        ["MAINTENANCE_DISABLED", "MAINTENANCE_CANCELLED", "DELETED"]
    );

    const cancelledActivity = db.activities.find(
        (row) => row.action === "MAINTENANCE_CANCELLED"
    );
    assert.ok(cancelledActivity);
    assert.equal(cancelledActivity.details.cancelledJobs, 2);
    assert.equal(cancelledActivity.details.reason, "asset_archived");
    assert.equal(cancelledActivity.details.performedBy, "Alex Morgan");

    // The trigger still fires once on the asset.update, but by that point the
    // service has already cancelled jobs and disabled the schedule, so its
    // effect is a no-op.
    assert.equal(db.getTriggerFireCount(), 1);
});

test("raw archivedAt update bypassing the service fires the trigger safety net to cancel jobs and disable schedule without writing audit rows", async () => {
    const db = createFakeDb(buildSeed());

    await db.client.asset.update({
        where: { id: "asset_1" },
        data: { archivedAt: new Date("2026-05-14T12:00:00.000Z") },
    });

    assert.ok(db.getAsset("asset_1")?.archivedAt instanceof Date);
    assert.equal(db.getSchedule("sched_1")?.isActive, false);
    assert.equal(db.getJob("job_open")?.status, "CANCELLED");
    assert.equal(db.getJob("job_in_progress")?.status, "CANCELLED");
    assert.equal(db.getJob("job_completed")?.status, "COMPLETED");

    assert.equal(db.activities.length, 0);
    assert.equal(db.getTriggerFireCount(), 1);
});

test("service archive path and raw-update safety net converge on identical maintenance state (schedule and jobs), while assets.status remains an application-layer concern", async () => {
    const serviceDb = createFakeDb(buildSeed());
    const rawDb = createFakeDb(buildSeed());

    await archiveAssetWithContext(
        { assetId: "asset_1", tenantId, user: managerUser },
        serviceDb.client as unknown as ArchiveAssetClient
    );

    await rawDb.client.asset.update({
        where: { id: "asset_1" },
        data: { archivedAt: new Date() },
    });

    assert.deepEqual(
        maintenanceFingerprint(serviceDb),
        maintenanceFingerprint(rawDb)
    );

    // assets.status is intentionally outside the trigger's contract: the
    // service path sets RETIRED, the raw-update path leaves it alone. This
    // assertion locks that boundary in so a future change to widen the
    // trigger's scope (or a regression that narrows the service's) is caught.
    assert.equal(serviceDb.getAsset("asset_1")?.status, "RETIRED");
    assert.equal(rawDb.getAsset("asset_1")?.status, "AVAILABLE");
});
