/**
 * Silent notification backfill (Module 10 M4, PRD §6.6 + §18).
 *
 * Run ONCE per environment immediately before flipping the daily cron on.
 *
 *   DATABASE_URL="<env db url>" npx tsx scripts/notifications-backfill-silent.ts
 *
 * Inserts notification rows for currently-overdue maintenance jobs, due-soon
 * maintenance jobs, and warranties expiring within 30 days. Each row is
 * pre-stamped with `readAt = dismissedAt = emailSentAt = NOW()` so it is
 * invisible to the inbox query, invisible to the digest query, and blocked
 * from being re-created by the fire-once unique constraint on the next cron.
 *
 * Net effect: existing in-flight conditions stop producing a "first run"
 * email flood. Only NEW conditions arising after this run will surface.
 *
 * Idempotent: re-running just counts duplicate rejections — no extra writes.
 */

import { addDays, format } from "date-fns";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getTodayStart } from "@/lib/dates";
import { MAINTENANCE_DUE_SOON_DAYS } from "@/lib/maintenance";
import {
    buildDedupeKey,
    resolveRecipientsForType,
    ScanRecipientCache,
} from "@/lib/notification-service";

const SCAN_PAGE_SIZE = 500;
const SCAN_MAX_PAGES = 20;
const WARRANTY_DAYS = 30;

type MaintenanceBackfillType = "MAINTENANCE_OVERDUE" | "MAINTENANCE_DUE_SOON";

type BackfillResult = {
    overdueProcessed: number;
    dueSoonProcessed: number;
    warrantyProcessed: number;
    rowsInserted: number;
    rowsSkipped: number; // dedupe collisions (script idempotency)
};

const EMPTY_RESULT: BackfillResult = {
    overdueProcessed: 0,
    dueSoonProcessed: 0,
    warrantyProcessed: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
};

type SilentRow = {
    tenantId: string;
    userId: string;
    type: "MAINTENANCE_OVERDUE" | "MAINTENANCE_DUE_SOON" | "WARRANTY_EXPIRING";
    sourceType: "MAINTENANCE_JOB" | "ASSET";
    sourceId: string;
    dedupeSuffix?: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
};

function formatDate(d: Date): string {
    return format(d, "MMM d, yyyy");
}

async function insertSilent(row: SilentRow, now: Date): Promise<"inserted" | "duplicate"> {
    const dedupeKey = buildDedupeKey(row.type, row.sourceId, row.dedupeSuffix);
    try {
        await db.notification.create({
            data: {
                tenantId: row.tenantId,
                userId: row.userId,
                type: row.type,
                sourceType: row.sourceType,
                sourceId: row.sourceId,
                dedupeKey,
                title: row.title,
                body: row.body,
                payload: row.payload as Prisma.InputJsonValue,
                inAppVisible: true,
                emailEligible: true,
                readAt: now,
                dismissedAt: now,
                emailSentAt: now,
            },
        });
        return "inserted";
    } catch (err) {
        if ((err as { code?: unknown } | null | undefined)?.code === "P2002") {
            return "duplicate";
        }
        throw err;
    }
}

async function backfillMaintenanceWindow(
    type: MaintenanceBackfillType,
    where: { lt: Date } | { gte: Date; lte: Date },
    now: Date,
    result: BackfillResult,
): Promise<void> {
    const cache = new ScanRecipientCache();
    let cursor: string | undefined;

    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
        const jobs = await db.maintenanceJob.findMany({
            where: {
                status: "OPEN",
                dueAt: where,
                asset: { archivedAt: null, tenant: { isActive: true } },
            },
            select: {
                id: true,
                dueAt: true,
                asset: {
                    select: { id: true, name: true, tenantId: true, assignedToId: true },
                },
            },
            orderBy: [{ dueAt: "asc" }, { id: "asc" }],
            take: SCAN_PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (jobs.length === 0) break;

        for (const job of jobs) {
            if (type === "MAINTENANCE_OVERDUE") result.overdueProcessed += 1;
            else result.dueSoonProcessed += 1;

            const recipients = await resolveRecipientsForType(
                type,
                { tenantId: job.asset.tenantId, assigneeId: job.asset.assignedToId },
                db,
                cache,
            );

            const dueLabel = formatDate(job.dueAt);
            const title =
                type === "MAINTENANCE_OVERDUE" ? "Maintenance overdue" : "Maintenance due soon";
            const body =
                type === "MAINTENANCE_OVERDUE"
                    ? `${job.asset.name} maintenance was due on ${dueLabel}.`
                    : `${job.asset.name} maintenance is due on ${dueLabel}.`;

            for (const userId of recipients) {
                const outcome = await insertSilent(
                    {
                        tenantId: job.asset.tenantId,
                        userId,
                        type,
                        sourceType: "MAINTENANCE_JOB",
                        sourceId: job.id,
                        title,
                        body,
                        payload: {
                            assetId: job.asset.id,
                            assetName: job.asset.name,
                            jobId: job.id,
                            dueAt: job.dueAt.toISOString(),
                        },
                    },
                    now,
                );
                if (outcome === "inserted") result.rowsInserted += 1;
                else result.rowsSkipped += 1;
            }
        }

        cursor = jobs[jobs.length - 1].id;
        if (jobs.length < SCAN_PAGE_SIZE) break;
    }
}

async function backfillWarranty(now: Date, result: BackfillResult): Promise<void> {
    const today = getTodayStart(now);
    const horizon = addDays(today, WARRANTY_DAYS);
    const cache = new ScanRecipientCache();
    let cursor: string | undefined;

    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
        const assets = await db.asset.findMany({
            where: {
                archivedAt: null,
                warrantyEnd: { gte: today, lte: horizon },
                tenant: { isActive: true },
            },
            select: {
                id: true,
                name: true,
                tenantId: true,
                warrantyEnd: true,
                assignedToId: true,
            },
            orderBy: [{ warrantyEnd: "asc" }, { id: "asc" }],
            take: SCAN_PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (assets.length === 0) break;

        for (const asset of assets) {
            if (!asset.warrantyEnd) continue;
            result.warrantyProcessed += 1;

            const recipients = await resolveRecipientsForType(
                "WARRANTY_EXPIRING",
                { tenantId: asset.tenantId, assigneeId: asset.assignedToId },
                db,
                cache,
            );

            const endLabel = formatDate(asset.warrantyEnd);
            const dedupeSuffix = asset.warrantyEnd.toISOString().slice(0, 10);
            const body = `${asset.name}'s warranty ends on ${endLabel}.`;

            for (const userId of recipients) {
                const outcome = await insertSilent(
                    {
                        tenantId: asset.tenantId,
                        userId,
                        type: "WARRANTY_EXPIRING",
                        sourceType: "ASSET",
                        sourceId: asset.id,
                        dedupeSuffix,
                        title: "Warranty expiring",
                        body,
                        payload: {
                            assetId: asset.id,
                            assetName: asset.name,
                            warrantyEnd: asset.warrantyEnd.toISOString(),
                        },
                    },
                    now,
                );
                if (outcome === "inserted") result.rowsInserted += 1;
                else result.rowsSkipped += 1;
            }
        }

        cursor = assets[assets.length - 1].id;
        if (assets.length < SCAN_PAGE_SIZE) break;
    }
}

async function main(): Promise<void> {
    const now = new Date();
    const today = getTodayStart(now);
    const result: BackfillResult = { ...EMPTY_RESULT };

    console.log("[backfill] starting silent notification backfill", {
        startedAt: now.toISOString(),
    });

    await backfillMaintenanceWindow("MAINTENANCE_OVERDUE", { lt: today }, now, result);
    await backfillMaintenanceWindow(
        "MAINTENANCE_DUE_SOON",
        { gte: today, lte: addDays(today, MAINTENANCE_DUE_SOON_DAYS) },
        now,
        result,
    );
    await backfillWarranty(now, result);

    console.log("[backfill] complete", result);
}

main()
    .then(async () => {
        await db.$disconnect();
    })
    .catch(async (err) => {
        console.error("[backfill] failed", err);
        await db.$disconnect();
        process.exit(1);
    });
