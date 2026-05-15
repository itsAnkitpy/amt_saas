import {
    Prisma,
    type Notification,
    type NotificationSourceType,
    type NotificationType,
} from "@/generated/prisma";
import { db } from "@/lib/db";

type RecipientResolverClient = Pick<typeof db, "user">;

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
// Recipient resolution
// ============================================

/**
 * Minimal source shape consumed by `resolveRecipientsForType`.
 * Callers (cron scans, assignment emit) pass what they have.
 */
export type RecipientSource = {
    tenantId: string;
    /** Current asset assignee, if any. Used only by OVERDUE and ASSIGNED_TO_YOU. */
    assigneeId?: string | null;
};

/**
 * Per-scan cache for tenant-wide ADMIN+MANAGER recipients.
 *
 * Cron scans iterate many source rows that usually belong to a small set of
 * tenants. Without this cache, every source row triggers a fresh user query;
 * with it, each tenant is queried once per scan run.
 */
export class ScanRecipientCache {
    private adminMgrByTenant = new Map<string, string[]>();
    constructor(private client: RecipientResolverClient = db) {}

    async getAdminMgr(tenantId: string): Promise<string[]> {
        const cached = this.adminMgrByTenant.get(tenantId);
        if (cached) return cached;
        const rows = await this.client.user.findMany({
            where: {
                tenantId,
                isActive: true,
                role: { in: ["ADMIN", "MANAGER"] },
            },
            select: { id: true },
        });
        const ids = rows.map((r) => r.id);
        this.adminMgrByTenant.set(tenantId, ids);
        return ids;
    }

    /** Active + same-tenant check for an assignee not already in admin/mgr. */
    async isValidAssignee(tenantId: string, assigneeId: string): Promise<boolean> {
        const adminMgr = this.adminMgrByTenant.get(tenantId);
        if (adminMgr?.includes(assigneeId)) return true;
        const row = await this.client.user.findFirst({
            where: { id: assigneeId, tenantId, isActive: true },
            select: { id: true },
        });
        return row !== null;
    }
}

/**
 * Returns the recipient userIds for a given event type per PRD §5.
 *
 *   OVERDUE              -> ADMIN+MANAGER tenant-wide ∪ assignee (if any)
 *   DUE_SOON             -> ADMIN+MANAGER tenant-wide
 *   WARRANTY_EXPIRING    -> ADMIN+MANAGER tenant-wide
 *   ASSIGNED_TO_YOU      -> assignee only
 *
 * Always excludes `isActive=false` users. Tenant-active filtering is the
 * scan's responsibility (applied at the source query for efficiency).
 *
 * Pass `cache` from a cron scan to avoid re-querying ADMIN+MANAGER per
 * source row.
 */
export async function resolveRecipientsForType(
    type: NotificationType,
    source: RecipientSource,
    client: RecipientResolverClient = db,
    cache?: ScanRecipientCache,
): Promise<string[]> {
    if (type === "ASSET_ASSIGNED_TO_YOU") {
        if (!source.assigneeId) return [];
        const assignee = await client.user.findFirst({
            where: {
                id: source.assigneeId,
                tenantId: source.tenantId,
                isActive: true,
            },
            select: { id: true },
        });
        return assignee ? [assignee.id] : [];
    }

    const includeAssignee =
        type === "MAINTENANCE_OVERDUE" && !!source.assigneeId;

    if (cache) {
        const adminMgr = await cache.getAdminMgr(source.tenantId);
        if (!includeAssignee) return adminMgr;
        if (adminMgr.includes(source.assigneeId!)) return adminMgr;
        const ok = await cache.isValidAssignee(source.tenantId, source.assigneeId!);
        return ok ? [...adminMgr, source.assigneeId!] : adminMgr;
    }

    const users = await client.user.findMany({
        where: {
            tenantId: source.tenantId,
            isActive: true,
            OR: [
                { role: { in: ["ADMIN", "MANAGER"] } },
                ...(includeAssignee ? [{ id: source.assigneeId! }] : []),
            ],
        },
        select: { id: true },
    });

    return users.map((u) => u.id);
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
        // Duck-type the Prisma error code: in Next.js server bundles,
        // `instanceof Prisma.PrismaClientKnownRequestError` can fail across
        // module realms even when the runtime error is a P2002.
        if ((err as { code?: unknown } | null | undefined)?.code === "P2002") {
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
