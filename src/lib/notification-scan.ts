import { addDays, format } from "date-fns";
import { db } from "@/lib/db";
import { getTodayStart } from "@/lib/dates";
import { MAINTENANCE_DUE_SOON_DAYS } from "@/lib/maintenance";
import {
    type CreateNotificationInput,
    createNotification,
    resolveRecipientsForType,
} from "@/lib/notification-service";

/**
 * Time-driven scans that emit MAINTENANCE_OVERDUE, MAINTENANCE_DUE_SOON, and
 * WARRANTY_EXPIRING notifications. Invoked by the cron route once per day.
 *
 * Each scan paginates with a hard cap so one run is bounded. Anything not
 * processed today is picked up tomorrow — fire-once dedupe makes resumption
 * safe.
 */

export const SCAN_PAGE_SIZE = 500;
export const SCAN_MAX_PAGES = 20;
export const WARRANTY_DAYS = 30;

export type ScanResult = {
    /** Rows fetched from the source table (jobs or assets). */
    processed: number;
    /** Notification rows inserted across all recipients. */
    created: number;
    /** Recipient slots that did NOT insert (prefs off or dedupe collision). */
    skipped: number;
    /** Recipient slots that threw — counted, logged, scan continues. */
    failed: number;
};

const EMPTY: ScanResult = { processed: 0, created: 0, skipped: 0, failed: 0 };

function formatDate(d: Date): string {
    return format(d, "MMM d, yyyy");
}

async function recordOne(input: CreateNotificationInput): Promise<ScanResult> {
    try {
        const r = await createNotification(input);
        return { processed: 0, created: r.created, skipped: r.skipped, failed: 0 };
    } catch (err) {
        console.error("[notification-scan] createNotification failed", {
            type: input.type,
            sourceId: input.sourceId,
            tenantId: input.tenantId,
            userId: input.userId,
            error: err instanceof Error ? err.message : String(err),
        });
        return { processed: 0, created: 0, skipped: 0, failed: 1 };
    }
}

function accumulate(into: ScanResult, add: ScanResult): void {
    into.processed += add.processed;
    into.created += add.created;
    into.skipped += add.skipped;
    into.failed += add.failed;
}

// ============================================
// Maintenance scans
// ============================================

type MaintenanceJobRow = {
    id: string;
    dueAt: Date;
    asset: {
        id: string;
        name: string;
        tenantId: string;
        assignedToId: string | null;
    };
};

async function scanMaintenanceWindow(
    type: "MAINTENANCE_OVERDUE" | "MAINTENANCE_DUE_SOON",
    where: { lt: Date } | { gte: Date; lte: Date },
): Promise<ScanResult> {
    const result: ScanResult = { ...EMPTY };
    let cursor: string | undefined;

    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
        const jobs: MaintenanceJobRow[] = await db.maintenanceJob.findMany({
            where: {
                status: "OPEN",
                dueAt: where,
                asset: {
                    archivedAt: null,
                    tenant: { isActive: true },
                },
            },
            select: {
                id: true,
                dueAt: true,
                asset: {
                    select: {
                        id: true,
                        name: true,
                        tenantId: true,
                        assignedToId: true,
                    },
                },
            },
            orderBy: [{ dueAt: "asc" }, { id: "asc" }],
            take: SCAN_PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (jobs.length === 0) break;

        for (const job of jobs) {
            result.processed += 1;

            const recipients = await resolveRecipientsForType(type, {
                tenantId: job.asset.tenantId,
                assigneeId: job.asset.assignedToId,
            });

            const dueLabel = formatDate(job.dueAt);
            const title =
                type === "MAINTENANCE_OVERDUE"
                    ? "Maintenance overdue"
                    : "Maintenance due soon";
            const body =
                type === "MAINTENANCE_OVERDUE"
                    ? `${job.asset.name} maintenance was due on ${dueLabel}.`
                    : `${job.asset.name} maintenance is due on ${dueLabel}.`;

            for (const userId of recipients) {
                accumulate(
                    result,
                    await recordOne({
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
                    }),
                );
            }
        }

        cursor = jobs[jobs.length - 1].id;
        if (jobs.length < SCAN_PAGE_SIZE) break;
    }

    return result;
}

export function scanOverdueMaintenance(now: Date = new Date()): Promise<ScanResult> {
    const today = getTodayStart(now);
    return scanMaintenanceWindow("MAINTENANCE_OVERDUE", { lt: today });
}

export function scanDueSoonMaintenance(now: Date = new Date()): Promise<ScanResult> {
    const today = getTodayStart(now);
    const horizon = addDays(today, MAINTENANCE_DUE_SOON_DAYS);
    return scanMaintenanceWindow("MAINTENANCE_DUE_SOON", {
        gte: today,
        lte: horizon,
    });
}

// ============================================
// Warranty scan
// ============================================

type WarrantyAssetRow = {
    id: string;
    name: string;
    tenantId: string;
    warrantyEnd: Date | null;
    assignedToId: string | null;
};

export async function scanExpiringWarranties(
    now: Date = new Date(),
): Promise<ScanResult> {
    const result: ScanResult = { ...EMPTY };
    const today = getTodayStart(now);
    const horizon = addDays(today, WARRANTY_DAYS);

    let cursor: string | undefined;

    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
        const assets: WarrantyAssetRow[] = await db.asset.findMany({
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
            result.processed += 1;

            const recipients = await resolveRecipientsForType("WARRANTY_EXPIRING", {
                tenantId: asset.tenantId,
                assigneeId: asset.assignedToId,
            });

            const endLabel = formatDate(asset.warrantyEnd);
            // ISO date (YYYY-MM-DD) is the dedupe suffix so a date change re-fires.
            const dedupeSuffix = asset.warrantyEnd.toISOString().slice(0, 10);
            const body = `${asset.name}'s warranty ends on ${endLabel}.`;

            for (const userId of recipients) {
                accumulate(
                    result,
                    await recordOne({
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
                    }),
                );
            }
        }

        cursor = assets[assets.length - 1].id;
        if (assets.length < SCAN_PAGE_SIZE) break;
    }

    return result;
}
