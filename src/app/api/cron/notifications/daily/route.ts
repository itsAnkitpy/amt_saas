import { env } from "@/lib/env";
import { sendDailyDigests, type DigestResult } from "@/lib/notification-digest";
import {
    scanDueSoonMaintenance,
    scanExpiringWarranties,
    scanOverdueMaintenance,
    type ScanResult,
} from "@/lib/notification-scan";

/**
 * Daily notification cron.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron injects this
 * header automatically when `CRON_SECRET` is set on the project.
 *
 * Pipeline:
 *   1. Scan overdue / due-soon / warranty → insert in-app notifications.
 *   2. Send daily digest emails for unread + email-eligible rows.
 *
 * Bubbles infra errors to the cron run log; per-recipient `createNotification`
 * failures are caught inside the scan, per-user `sendEmail` failures are
 * caught inside the digest sender.
 */

// Force-disable static evaluation / caching at build time.
export const dynamic = "force-dynamic";

type CronResponse = {
    ok: true;
    durationMs: number;
    results: {
        overdue: ScanResult;
        dueSoon: ScanResult;
        warranty: ScanResult;
        digest: DigestResult;
    };
};

export async function GET(req: Request): Promise<Response> {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const started = Date.now();
    const now = new Date();

    const overdue = await scanOverdueMaintenance(now);
    const dueSoon = await scanDueSoonMaintenance(now);
    const warranty = await scanExpiringWarranties(now);
    const digest = await sendDailyDigests(now);

    const durationMs = Date.now() - started;

    const body: CronResponse = {
        ok: true,
        durationMs,
        results: { overdue, dueSoon, warranty, digest },
    };

    console.log("[cron/notifications/daily] complete", body);

    return Response.json(body);
}
