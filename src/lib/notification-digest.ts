import { type Notification, type NotificationType } from "@/generated/prisma";
import { db } from "@/lib/db";
import { sendEmail, type SendEmailInput } from "@/lib/email";
import { DailyDigest, type DigestItem, type DigestSections } from "@/emails/daily-digest";

/**
 * Daily digest sender (Module 10 M3, PRD §6.4).
 *
 * Runs after the scans inside the daily cron route. For each tenant with
 * eligible rows:
 *   1. Loads email-eligible, unsent, unread, undismissed rows.
 *   2. Groups by recipient userId.
 *   3. Sends one digest per user with bounded concurrency.
 *   4. On success, stamps `emailSentAt = NOW()` on that user's rows.
 *   5. On send failure, leaves rows untouched so the next run retries.
 *   6. Skipped users (inactive / no email) get their rows stamped too, so
 *      they never re-enter the eligible set.
 *
 * Failure isolation: a thrown send error for user A does not prevent users
 * B–Z from being processed. Per-tenant queries cap memory.
 */

export const DIGEST_SEND_CONCURRENCY = 5;

export type DigestResult = {
    tenantsProcessed: number;
    /** Users who had at least one eligible row this run. */
    usersAttempted: number;
    /** Users for whom sendEmail() resolved. */
    digestsSent: number;
    /** Users for whom sendEmail() threw. */
    digestsFailed: number;
    /** Notification rows transitioned to emailSentAt != null. */
    rowsMarked: number;
    /** Users with rows but no active User record or no email — skipped. */
    usersSkipped: number;
};

const EMPTY_RESULT: DigestResult = {
    tenantsProcessed: 0,
    usersAttempted: 0,
    digestsSent: 0,
    digestsFailed: 0,
    rowsMarked: 0,
    usersSkipped: 0,
};

const SECTION_BY_TYPE: Record<NotificationType, keyof DigestSections> = {
    MAINTENANCE_OVERDUE: "overdue",
    MAINTENANCE_DUE_SOON: "dueSoon",
    WARRANTY_EXPIRING: "warranty",
    ASSET_ASSIGNED_TO_YOU: "assigned",
};

type EligibleRow = Pick<Notification, "id" | "userId" | "type" | "title" | "body">;

function emptySections(): DigestSections {
    return { overdue: [], dueSoon: [], warranty: [], assigned: [] };
}

function groupByUser(rows: EligibleRow[]): Map<string, EligibleRow[]> {
    const byUser = new Map<string, EligibleRow[]>();
    for (const r of rows) {
        const arr = byUser.get(r.userId);
        if (arr) arr.push(r);
        else byUser.set(r.userId, [r]);
    }
    return byUser;
}

function buildSections(rows: EligibleRow[]): DigestSections {
    const sections = emptySections();
    for (const row of rows) {
        const bucket = SECTION_BY_TYPE[row.type];
        const item: DigestItem = { id: row.id, title: row.title, body: row.body };
        sections[bucket].push(item);
    }
    return sections;
}

/**
 * Bounded-concurrency runner. Workers pull from a shared index so slow
 * sends do not stall faster ones. No external dep needed.
 */
async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    const limit = Math.min(concurrency, items.length);
    if (limit === 0) return;
    let next = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (true) {
            const idx = next++;
            if (idx >= items.length) return;
            await fn(items[idx]);
        }
    });
    await Promise.all(workers);
}

function fullName(firstName: string, lastName: string | null): string {
    return lastName ? `${firstName} ${lastName}` : firstName;
}

function baseUrl(): string {
    // NEXT_PUBLIC_APP_URL is documented in .env.example and used here for
    // absolute deep links inside the email body. Falls back to localhost so
    // local dev works without extra config.
    const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return raw.replace(/\/$/, "");
}

/**
 * Optional DI seam: tests pass a stub `send` to verify routing + row
 * transitions without spinning up an SMTP server.
 */
export type SendDailyDigestsDeps = {
    send?: (input: SendEmailInput) => Promise<void>;
};

export async function sendDailyDigests(
    now: Date = new Date(),
    deps: SendDailyDigestsDeps = {},
): Promise<DigestResult> {
    const send = deps.send ?? sendEmail;
    const result: DigestResult = { ...EMPTY_RESULT };

    // 1. Find every tenant that has at least one row to send today.
    const tenantRows = await db.notification.findMany({
        where: {
            emailEligible: true,
            emailSentAt: null,
            readAt: null,
            dismissedAt: null,
        },
        distinct: ["tenantId"],
        select: { tenantId: true },
    });

    for (const { tenantId } of tenantRows) {
        const tenant = await db.tenant.findFirst({
            where: { id: tenantId, isActive: true },
            select: { name: true, slug: true },
        });
        if (!tenant) continue; // tenant deactivated between scans and digest; skip
        result.tenantsProcessed += 1;

        const rows: EligibleRow[] = await db.notification.findMany({
            where: {
                tenantId,
                emailEligible: true,
                emailSentAt: null,
                readAt: null,
                dismissedAt: null,
            },
            orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
            select: { id: true, userId: true, type: true, title: true, body: true },
        });
        if (rows.length === 0) continue;

        const byUser = groupByUser(rows);
        const userIds = [...byUser.keys()];

        const users = await db.user.findMany({
            where: { id: { in: userIds }, tenantId, isActive: true },
            select: { id: true, email: true, firstName: true, lastName: true },
        });
        const userById = new Map(users.map((u) => [u.id, u]));

        const tasks = userIds.map((userId) => ({ userId, rows: byUser.get(userId)! }));
        result.usersAttempted += tasks.length;

        await runWithConcurrency(tasks, DIGEST_SEND_CONCURRENCY, async ({ userId, rows: userRows }) => {
            const user = userById.get(userId);
            if (!user || !user.email) {
                console.warn("[notification-digest] skipping user with no active record", {
                    tenantId,
                    userId,
                    rowCount: userRows.length,
                });
                result.usersSkipped += 1;
                // Stamp the rows anyway: an inactive/emailless user must not keep
                // their rows in the eligible set to be refetched every run forever.
                try {
                    const updated = await db.notification.updateMany({
                        where: { id: { in: userRows.map((r) => r.id) } },
                        data: { emailSentAt: now },
                    });
                    result.rowsMarked += updated.count;
                } catch (err) {
                    console.error("[notification-digest] failed to stamp skipped rows", {
                        tenantId,
                        userId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
                return;
            }

            const sections = buildSections(userRows);
            const recipientName = fullName(user.firstName, user.lastName);

            try {
                await send({
                    to: user.email,
                    subject: `${tenant.name} · Daily digest`,
                    react: DailyDigest({
                        tenantName: tenant.name,
                        tenantSlug: tenant.slug,
                        date: now,
                        recipientName,
                        recipientEmail: user.email,
                        baseUrl: baseUrl(),
                        sections,
                    }),
                });
            } catch (err) {
                console.error("[notification-digest] sendEmail failed", {
                    tenantId,
                    userId,
                    rowCount: userRows.length,
                    error: err instanceof Error ? err.message : String(err),
                });
                result.digestsFailed += 1;
                return;
            }

            // Stamp only this user's rows. Send failures above keep rows null for
            // next-day retry. A stamp failure must not abort the whole run: log it
            // and move on — the rows retry next day (at-least-once delivery).
            result.digestsSent += 1;
            try {
                const updated = await db.notification.updateMany({
                    where: { id: { in: userRows.map((r) => r.id) } },
                    data: { emailSentAt: now },
                });
                result.rowsMarked += updated.count;
            } catch (err) {
                console.error("[notification-digest] emailSentAt stamp failed after send", {
                    tenantId,
                    userId,
                    rowCount: userRows.length,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        });
    }

    return result;
}
