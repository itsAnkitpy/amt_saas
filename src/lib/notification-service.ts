import {
    Prisma,
    type Notification,
    type NotificationSourceType,
    type NotificationType,
} from "@/generated/prisma";
import { db } from "@/lib/db";

/**
 * Notification write authority + inbox reads.
 *
 * Single recipient per call. Fan-out (multi-user) is the caller's
 * responsibility (e.g., cron loops over recipients per event).
 *
 * Error policy:
 *   - createNotification THROWS on infra errors. Cron uses this directly so
 *     failures bubble to logs.
 *   - safeCreateNotification swallows + logs. Use from asset-service and other
 *     inline services where the parent operation must not fail.
 */

export type CreateNotificationInput = {
    tenantId: string;
    userId: string; // single recipient
    type: NotificationType;
    sourceType: NotificationSourceType;
    sourceId: string;
    /**
     * Optional component appended to the dedupe key, e.g. the warranty
     * end-date ISO string. Required for WARRANTY_EXPIRING.
     */
    dedupeSuffix?: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
};

export type CreateNotificationResult = {
    created: number; // rows actually inserted (0 or 1 per call)
    skipped: number; // blocked by prefs OR dedupe collision
};

export type EffectivePreference = {
    inApp: boolean;
    email: boolean;
};

export type VisibilityFlags = {
    inAppVisible: boolean;
    emailEligible: boolean;
    /** True when both channels are disabled — caller should not insert. */
    allDisabled: boolean;
};

// ============================================
// Pure helpers (unit-testable, no DB)
// ============================================

/**
 * Builds the per-type fire-once dedupe key.
 *
 *   MAINTENANCE_OVERDUE    -> "job:<jobId>"
 *   MAINTENANCE_DUE_SOON   -> "job:<jobId>"
 *   WARRANTY_EXPIRING      -> "asset:<assetId>:<warrantyEnd-ISODate>"  (requires suffix)
 *   ASSET_ASSIGNED_TO_YOU  -> "assignment:<assignmentId>"
 */
export function buildDedupeKey(
    type: NotificationType,
    sourceId: string,
    suffix?: string,
): string {
    if (!sourceId) {
        throw new Error("buildDedupeKey: sourceId is required");
    }
    switch (type) {
        case "MAINTENANCE_OVERDUE":
        case "MAINTENANCE_DUE_SOON":
            return `job:${sourceId}`;
        case "WARRANTY_EXPIRING":
            if (!suffix) {
                throw new Error(
                    "buildDedupeKey: WARRANTY_EXPIRING requires a suffix (warrantyEnd ISO date)",
                );
            }
            return `asset:${sourceId}:${suffix}`;
        case "ASSET_ASSIGNED_TO_YOU":
            return `assignment:${sourceId}`;
    }
}

/**
 * Maps a user's preference to row-level visibility flags.
 *
 * Row is created only when at least one channel is enabled. If both are
 * disabled, `allDisabled = true` and the caller skips the insert entirely.
 */
export function computeVisibilityFlags(pref: EffectivePreference): VisibilityFlags {
    return {
        inAppVisible: pref.inApp,
        emailEligible: pref.email,
        allDisabled: !pref.inApp && !pref.email,
    };
}

// ============================================
// Preference resolution
// ============================================

/**
 * Returns effective preference for a user + type. Missing row falls back to
 * defaults (both channels ON — Q6 opt-out policy).
 */
export async function getEffectivePreference(
    tenantId: string,
    userId: string,
    type: NotificationType,
): Promise<EffectivePreference> {
    const row = await db.notificationPreference.findUnique({
        where: { tenantId_userId_type: { tenantId, userId, type } },
        select: { inApp: true, email: true },
    });
    return {
        inApp: row?.inApp ?? true,
        email: row?.email ?? true,
    };
}

// ============================================
// Writes
// ============================================

/**
 * Core writer. Single recipient.
 *
 * - Resolves the recipient's preference.
 * - Skips insert entirely if both channels are disabled.
 * - Otherwise inserts with per-row visibility flags.
 * - Unique constraint on (tenantId, userId, type, dedupeKey) gives fire-once.
 *
 * THROWS on infra errors. Use from cron directly. Wrap in
 * safeCreateNotification when calling from a user-facing write path.
 */
export async function createNotification(
    input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
    const pref = await getEffectivePreference(input.tenantId, input.userId, input.type);
    const flags = computeVisibilityFlags(pref);

    if (flags.allDisabled) {
        return { created: 0, skipped: 1 };
    }

    const dedupeKey = buildDedupeKey(input.type, input.sourceId, input.dedupeSuffix);

    try {
        await db.notification.create({
            data: {
                tenantId: input.tenantId,
                userId: input.userId,
                type: input.type,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                dedupeKey,
                title: input.title,
                body: input.body,
                payload: (input.payload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
                inAppVisible: flags.inAppVisible,
                emailEligible: flags.emailEligible,
            },
        });
        return { created: 1, skipped: 0 };
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // Dedupe collision — expected; not an error.
            return { created: 0, skipped: 1 };
        }
        throw err;
    }
}

/**
 * Inline-caller wrapper. Swallows errors with a log line. Use from
 * asset-service / maintenance-service so the parent operation never
 * fails because of a notification write.
 */
export async function safeCreateNotification(
    input: CreateNotificationInput,
): Promise<void> {
    try {
        await createNotification(input);
    } catch (err) {
        // Match activity-log.ts: log & continue.
        console.error("[notification-service] safeCreateNotification failed", {
            type: input.type,
            sourceId: input.sourceId,
            tenantId: input.tenantId,
            userId: input.userId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

// ============================================
// Reads
// ============================================

export type ListNotificationsOpts = {
    unreadOnly?: boolean;
    limit?: number;
    cursor?: string;
};

export type NotificationPage = {
    items: Notification[];
    nextCursor: string | null;
};

/**
 * Paginated inbox for a single user. Excludes dismissed rows and rows
 * where in-app visibility is off (i.e., email-only deliveries).
 */
export async function listNotificationsForUser(
    userId: string,
    tenantId: string,
    opts: ListNotificationsOpts = {},
): Promise<NotificationPage> {
    const limit = opts.limit ?? 20;

    const rows = await db.notification.findMany({
        where: {
            userId,
            tenantId,
            inAppVisible: true,
            dismissedAt: null,
            ...(opts.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
    };
}

export function getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return db.notification.count({
        where: {
            userId,
            tenantId,
            inAppVisible: true,
            dismissedAt: null,
            readAt: null,
        },
    });
}

/**
 * Marks a single notification as read. Scoped by userId so a user cannot
 * touch another user's rows even by id-guessing.
 */
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt: new Date() },
    });
}

export async function markAllAsRead(userId: string, tenantId: string): Promise<void> {
    await db.notification.updateMany({
        where: {
            userId,
            tenantId,
            inAppVisible: true,
            dismissedAt: null,
            readAt: null,
        },
        data: { readAt: new Date() },
    });
}

/**
 * Dismiss = mark read AND hide. Sets both timestamps in one update so the
 * row drops out of inbox, unread count, and any future email digest.
 */
export async function dismissNotification(
    notificationId: string,
    userId: string,
): Promise<void> {
    const now = new Date();
    await db.notification.updateMany({
        where: { id: notificationId, userId, dismissedAt: null },
        data: { readAt: now, dismissedAt: now },
    });
}
