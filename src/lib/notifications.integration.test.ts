import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { after, before } from "node:test";

const require = createRequire(import.meta.url);
const { db } = require("./db.ts") as typeof import("./db");
const {
    createNotification,
    dismissNotification,
    getUnreadCount,
    listNotificationsForUser,
    markAsRead,
} = require("./notification-service.ts") as typeof import("./notification-service");

// Integration tests for the notification service against a real Postgres DB.
// Verifies the actual unique constraint, FK cascade, and prefs interaction —
// things the in-memory unit tests cannot catch.

const RUN_ID = `m1-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const tenantA = {
    id: `tn_${RUN_ID}_a`,
    slug: `tn-${RUN_ID}-a`,
    name: "Tenant A (test)",
};
const tenantB = {
    id: `tn_${RUN_ID}_b`,
    slug: `tn-${RUN_ID}-b`,
    name: "Tenant B (test)",
};
const userA = {
    id: `usr_${RUN_ID}_a`,
    email: `a-${RUN_ID}@test.local`,
    firstName: "Ada",
};
const userB = {
    id: `usr_${RUN_ID}_b`,
    email: `b-${RUN_ID}@test.local`,
    firstName: "Ben",
};

async function seed() {
    await db.tenant.createMany({
        data: [
            { id: tenantA.id, slug: tenantA.slug, name: tenantA.name },
            { id: tenantB.id, slug: tenantB.slug, name: tenantB.name },
        ],
    });
    await db.user.createMany({
        data: [
            {
                id: userA.id,
                email: userA.email,
                firstName: userA.firstName,
                tenantId: tenantA.id,
                role: "ADMIN",
            },
            {
                id: userB.id,
                email: userB.email,
                firstName: userB.firstName,
                tenantId: tenantB.id,
                role: "ADMIN",
            },
        ],
    });
}

async function cleanup() {
    // Cascade removes notifications + preferences via tenant FK
    await db.tenant.deleteMany({
        where: { id: { in: [tenantA.id, tenantB.id] } },
    });
}

before(async () => {
    await cleanup();
    await seed();
});

after(async () => {
    await cleanup();
    await db.$disconnect();
});

// Each test cleans its own notification rows to avoid cross-test interference
async function clearNotifications() {
    await db.notification.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.notificationPreference.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
}

// ============================================
// createNotification
// ============================================

test("createNotification inserts a row with pre-rendered display + visibility flags", async () => {
    await clearNotifications();
    const res = await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "ASSET_ASSIGNED_TO_YOU",
        sourceType: "ASSET_ASSIGNMENT",
        sourceId: "asgmt_x1",
        title: "You've been assigned an asset",
        body: "Laptop has been assigned to you.",
        payload: { assetId: "asset_1" },
    });

    assert.deepEqual(res, { created: 1, skipped: 0 });

    const rows = await db.notification.findMany({
        where: { tenantId: tenantA.id, userId: userA.id },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].dedupeKey, "assignment:asgmt_x1");
    assert.equal(rows[0].inAppVisible, true);
    assert.equal(rows[0].emailEligible, true);
    assert.equal(rows[0].readAt, null);
    assert.equal(rows[0].dismissedAt, null);
});

test("createNotification fire-once dedupe: second call with same key inserts nothing", async () => {
    await clearNotifications();
    const input = {
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE" as const,
        sourceType: "MAINTENANCE_JOB" as const,
        sourceId: "job_dup",
        title: "Maintenance overdue",
        body: "Overdue body",
    };
    const first = await createNotification(input);
    const second = await createNotification(input);

    assert.deepEqual(first, { created: 1, skipped: 0 });
    assert.deepEqual(second, { created: 0, skipped: 1 });

    const count = await db.notification.count({
        where: { tenantId: tenantA.id, userId: userA.id, sourceId: "job_dup" },
    });
    assert.equal(count, 1);
});

test("createNotification: warranty date change yields a NEW row (dedupe key includes date)", async () => {
    await clearNotifications();
    const baseInput = {
        tenantId: tenantA.id,
        userId: userA.id,
        type: "WARRANTY_EXPIRING" as const,
        sourceType: "ASSET" as const,
        sourceId: "asset_warranty",
        title: "Warranty expiring soon",
        body: "Body",
    };
    await createNotification({ ...baseInput, dedupeSuffix: "2026-01-01" });
    await createNotification({ ...baseInput, dedupeSuffix: "2027-06-15" });

    const rows = await db.notification.findMany({
        where: { tenantId: tenantA.id, sourceId: "asset_warranty" },
    });
    assert.equal(rows.length, 2);
    const keys = rows.map((r) => r.dedupeKey).sort();
    assert.deepEqual(keys, [
        "asset:asset_warranty:2026-01-01",
        "asset:asset_warranty:2027-06-15",
    ]);
});

test("createNotification skips entirely when both pref channels are disabled", async () => {
    await clearNotifications();
    await db.notificationPreference.create({
        data: {
            tenantId: tenantA.id,
            userId: userA.id,
            type: "MAINTENANCE_DUE_SOON",
            inApp: false,
            email: false,
        },
    });

    const res = await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_DUE_SOON",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_silent",
        title: "T",
        body: "B",
    });
    assert.deepEqual(res, { created: 0, skipped: 1 });

    const count = await db.notification.count({
        where: { tenantId: tenantA.id, userId: userA.id },
    });
    assert.equal(count, 0);
});

test("createNotification sets inAppVisible=false when only email is enabled", async () => {
    await clearNotifications();
    await db.notificationPreference.create({
        data: {
            tenantId: tenantA.id,
            userId: userA.id,
            type: "WARRANTY_EXPIRING",
            inApp: false,
            email: true,
        },
    });

    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "WARRANTY_EXPIRING",
        sourceType: "ASSET",
        sourceId: "asset_email_only",
        dedupeSuffix: "2026-12-31",
        title: "T",
        body: "B",
    });

    const row = await db.notification.findFirst({
        where: { tenantId: tenantA.id, userId: userA.id, sourceId: "asset_email_only" },
    });
    assert.ok(row);
    assert.equal(row.inAppVisible, false);
    assert.equal(row.emailEligible, true);
});

// ============================================
// listNotificationsForUser / getUnreadCount
// ============================================

test("listNotificationsForUser excludes dismissed + inAppVisible=false rows", async () => {
    await clearNotifications();
    // visible + unread
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_visible",
        title: "T",
        body: "B",
    });
    // visible but dismissed
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_DUE_SOON",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_dismiss",
        title: "T",
        body: "B",
    });
    const dismissable = await db.notification.findFirstOrThrow({
        where: { tenantId: tenantA.id, sourceId: "job_dismiss" },
    });
    await dismissNotification(dismissable.id, userA.id);

    // email-only (inAppVisible=false)
    await db.notificationPreference.create({
        data: {
            tenantId: tenantA.id,
            userId: userA.id,
            type: "WARRANTY_EXPIRING",
            inApp: false,
            email: true,
        },
    });
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "WARRANTY_EXPIRING",
        sourceType: "ASSET",
        sourceId: "asset_hidden",
        dedupeSuffix: "2026-01-01",
        title: "T",
        body: "B",
    });

    const page = await listNotificationsForUser(userA.id, tenantA.id);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0].sourceId, "job_visible");
});

test("getUnreadCount excludes read, dismissed, and email-only rows", async () => {
    await clearNotifications();
    // unread visible -> counts
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_unread",
        title: "T",
        body: "B",
    });
    // read -> excluded
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_DUE_SOON",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_read",
        title: "T",
        body: "B",
    });
    const readable = await db.notification.findFirstOrThrow({
        where: { tenantId: tenantA.id, sourceId: "job_read" },
    });
    await markAsRead(readable.id, userA.id);

    const count = await getUnreadCount(userA.id, tenantA.id);
    assert.equal(count, 1);
});

// ============================================
// Tenant isolation
// ============================================

test("listNotificationsForUser tenant isolation: tenant A query returns ONLY tenant A rows", async () => {
    await clearNotifications();
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_in_A",
        title: "T",
        body: "B",
    });
    await createNotification({
        tenantId: tenantB.id,
        userId: userB.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_in_B",
        title: "T",
        body: "B",
    });

    const aPage = await listNotificationsForUser(userA.id, tenantA.id);
    assert.equal(aPage.items.length, 1);
    assert.equal(aPage.items[0].sourceId, "job_in_A");

    // Even if userA's id is passed but with tenantB.id, they get nothing (no row matches both)
    const cross = await listNotificationsForUser(userA.id, tenantB.id);
    assert.equal(cross.items.length, 0);
});

// ============================================
// Dismiss + markAsRead semantics
// ============================================

test("dismissNotification sets BOTH readAt and dismissedAt", async () => {
    await clearNotifications();
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_dismiss_2",
        title: "T",
        body: "B",
    });
    const row = await db.notification.findFirstOrThrow({
        where: { tenantId: tenantA.id, sourceId: "job_dismiss_2" },
    });
    assert.equal(row.readAt, null);
    assert.equal(row.dismissedAt, null);

    await dismissNotification(row.id, userA.id);

    const after = await db.notification.findUniqueOrThrow({ where: { id: row.id } });
    assert.ok(after.readAt instanceof Date);
    assert.ok(after.dismissedAt instanceof Date);
});

test("markAsRead is scoped by userId — other users cannot mark someone else's row", async () => {
    await clearNotifications();
    await createNotification({
        tenantId: tenantA.id,
        userId: userA.id,
        type: "MAINTENANCE_OVERDUE",
        sourceType: "MAINTENANCE_JOB",
        sourceId: "job_protected",
        title: "T",
        body: "B",
    });
    const row = await db.notification.findFirstOrThrow({
        where: { tenantId: tenantA.id, sourceId: "job_protected" },
    });

    // Wrong user attempts mark-read — silent no-op
    await markAsRead(row.id, userB.id);
    const stillUnread = await db.notification.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(stillUnread.readAt, null);

    // Right user marks read
    await markAsRead(row.id, userA.id);
    const nowRead = await db.notification.findUniqueOrThrow({ where: { id: row.id } });
    assert.ok(nowRead.readAt instanceof Date);
});
