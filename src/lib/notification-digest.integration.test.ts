import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { after, before } from "node:test";

const require = createRequire(import.meta.url);
const { db } = require("./db.ts") as typeof import("./db");
const { sendDailyDigests } = require("./notification-digest.ts") as typeof import("./notification-digest");

// Integration tests for the daily digest sender (PRD §14).
// Verifies real-DB filter semantics + per-row emailSentAt transitions.
// sendEmail is replaced via DI so no SMTP is required.

const RUN_ID = `m3-digest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const tenantA = {
    id: `tn_${RUN_ID}_a`,
    slug: `tn-${RUN_ID}-a`,
    name: "Digest Tenant A",
};
const tenantB = {
    id: `tn_${RUN_ID}_b`,
    slug: `tn-${RUN_ID}-b`,
    name: "Digest Tenant B",
};
const userA = {
    id: `usr_${RUN_ID}_a`,
    email: `a-${RUN_ID}@test.local`,
    firstName: "Alice",
    lastName: "Admin",
};
const userB = {
    id: `usr_${RUN_ID}_b`,
    email: `b-${RUN_ID}@test.local`,
    firstName: "Bob",
    lastName: null as string | null,
};
const userInactive = {
    id: `usr_${RUN_ID}_inactive`,
    email: `c-${RUN_ID}@test.local`,
    firstName: "Carol",
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
            { id: userA.id, email: userA.email, firstName: userA.firstName, lastName: userA.lastName, tenantId: tenantA.id, role: "ADMIN" },
            { id: userB.id, email: userB.email, firstName: userB.firstName, tenantId: tenantB.id, role: "ADMIN" },
            { id: userInactive.id, email: userInactive.email, firstName: userInactive.firstName, tenantId: tenantA.id, role: "USER", isActive: false },
        ],
    });
}

async function cleanup() {
    await db.tenant.deleteMany({
        where: { id: { in: [tenantA.id, tenantB.id] } },
    });
}

/**
 * Tests in this suite call `sendDailyDigests()` with no tenant filter — so
 * any eligible row left in the DB by other suites would be processed too.
 * Stamp those rows as already-sent so they fall out of the eligibility filter
 * without disturbing other suites' cleanup logic.
 */
async function isolate() {
    await db.notification.updateMany({
        where: {
            emailSentAt: null,
            tenantId: { notIn: [tenantA.id, tenantB.id] },
        },
        data: { emailSentAt: new Date() },
    });
}

before(async () => {
    await cleanup();
    await seed();
    await isolate();
});

after(async () => {
    await cleanup();
    await db.$disconnect();
});

async function clearNotifications() {
    await db.notification.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.notificationPreference.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
}

type FakeSentEmail = {
    to: string | string[];
    subject: string;
};

function makeRecorder(): { calls: FakeSentEmail[]; send: (input: { to: string | string[]; subject: string; react: unknown }) => Promise<void> } {
    const calls: FakeSentEmail[] = [];
    return {
        calls,
        send: async (input) => {
            calls.push({ to: input.to, subject: input.subject });
        },
    };
}

function makeFailingRecorder(failFor: string): { calls: FakeSentEmail[]; send: (input: { to: string | string[]; subject: string; react: unknown }) => Promise<void> } {
    const calls: FakeSentEmail[] = [];
    return {
        calls,
        send: async (input) => {
            const recipient = Array.isArray(input.to) ? input.to[0] : input.to;
            if (recipient === failFor) {
                throw new Error("simulated transport failure");
            }
            calls.push({ to: input.to, subject: input.subject });
        },
    };
}

// ============================================
// Filter semantics
// ============================================

test("digest filter: only emailEligible + unsent + unread + undismissed rows go out", async () => {
    await clearNotifications();

    // 5 rows; only the first qualifies.
    await db.notification.createMany({
        data: [
            // ✓ Eligible
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_ok", dedupeKey: "job:job_ok",
              title: "Overdue", body: "Body" },
            // ✗ Already emailed
            { tenantId: tenantA.id, userId: userA.id, type: "WARRANTY_EXPIRING",
              sourceType: "ASSET", sourceId: "asset_sent", dedupeKey: "asset:asset_sent:2026-06-01",
              title: "Warranty", body: "Body", emailSentAt: new Date() },
            // ✗ Read in-app
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_DUE_SOON",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_read", dedupeKey: "job:job_read",
              title: "Due soon", body: "Body", readAt: new Date() },
            // ✗ Dismissed
            { tenantId: tenantA.id, userId: userA.id, type: "ASSET_ASSIGNED_TO_YOU",
              sourceType: "ASSET_ASSIGNMENT", sourceId: "asgmt_dismissed", dedupeKey: "assignment:asgmt_dismissed",
              title: "Assigned", body: "Body", dismissedAt: new Date() },
            // ✗ Email-only off
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_inapp_only", dedupeKey: "job:job_inapp_only",
              title: "Overdue", body: "Body", emailEligible: false },
        ],
    });

    const recorder = makeRecorder();
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.digestsSent, 1);
    assert.equal(result.digestsFailed, 0);
    assert.equal(result.rowsMarked, 1);
    assert.equal(recorder.calls.length, 1);
    assert.deepEqual(recorder.calls[0].to, userA.email);

    // The eligible row is now marked; the others are untouched.
    const all = await db.notification.findMany({
        where: { tenantId: tenantA.id, userId: userA.id },
        orderBy: { sourceId: "asc" },
    });
    const sentCount = all.filter((r) => r.emailSentAt !== null).length;
    // Pre-set "Already emailed" + the freshly-marked one = 2
    assert.equal(sentCount, 2);
});

// ============================================
// Grouping
// ============================================

test("digest groups multiple types for one user into a single email", async () => {
    await clearNotifications();

    await db.notification.createMany({
        data: [
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_g1", dedupeKey: "job:job_g1",
              title: "Overdue 1", body: "B1" },
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_DUE_SOON",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_g2", dedupeKey: "job:job_g2",
              title: "Due soon 1", body: "B2" },
            { tenantId: tenantA.id, userId: userA.id, type: "WARRANTY_EXPIRING",
              sourceType: "ASSET", sourceId: "asset_g1", dedupeKey: "asset:asset_g1:2026-07-01",
              title: "Warranty 1", body: "B3" },
        ],
    });

    const recorder = makeRecorder();
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.usersAttempted, 1);
    assert.equal(result.digestsSent, 1);
    assert.equal(result.rowsMarked, 3);
    assert.equal(recorder.calls.length, 1);
});

// ============================================
// Tenant isolation
// ============================================

test("digest isolates per tenant: each tenant's rows go to their own user", async () => {
    await clearNotifications();

    await db.notification.createMany({
        data: [
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_ta", dedupeKey: "job:job_ta",
              title: "Overdue A", body: "Body" },
            { tenantId: tenantB.id, userId: userB.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_tb", dedupeKey: "job:job_tb",
              title: "Overdue B", body: "Body" },
        ],
    });

    const recorder = makeRecorder();
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.tenantsProcessed, 2);
    assert.equal(result.digestsSent, 2);
    assert.equal(recorder.calls.length, 2);
    const recipients = recorder.calls.map((c) => (Array.isArray(c.to) ? c.to[0] : c.to)).sort();
    assert.deepEqual(recipients, [userA.email, userB.email].sort());
});

// ============================================
// Failure isolation
// ============================================

test("digest failure isolation: failed user's rows stay unsent and other users still receive", async () => {
    await clearNotifications();

    await db.notification.createMany({
        data: [
            { tenantId: tenantA.id, userId: userA.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_fail", dedupeKey: "job:job_fail",
              title: "Overdue (fail)", body: "Body" },
            { tenantId: tenantB.id, userId: userB.id, type: "MAINTENANCE_OVERDUE",
              sourceType: "MAINTENANCE_JOB", sourceId: "job_ok", dedupeKey: "job:job_ok",
              title: "Overdue (ok)", body: "Body" },
        ],
    });

    const recorder = makeFailingRecorder(userA.email);
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.digestsSent, 1);
    assert.equal(result.digestsFailed, 1);
    assert.equal(result.rowsMarked, 1);

    const failedRow = await db.notification.findFirstOrThrow({
        where: { sourceId: "job_fail" },
    });
    assert.equal(failedRow.emailSentAt, null, "failed user's row must stay null for retry");

    const sentRow = await db.notification.findFirstOrThrow({
        where: { sourceId: "job_ok" },
    });
    assert.notEqual(sentRow.emailSentAt, null);
});

// ============================================
// Inactive user
// ============================================

test("digest skips users with no active record; rows remain unsent for retry", async () => {
    await clearNotifications();

    await db.notification.create({
        data: {
            tenantId: tenantA.id,
            userId: userInactive.id,
            type: "MAINTENANCE_OVERDUE",
            sourceType: "MAINTENANCE_JOB",
            sourceId: "job_inactive",
            dedupeKey: "job:job_inactive",
            title: "Overdue",
            body: "Body",
        },
    });

    const recorder = makeRecorder();
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.usersAttempted, 1);
    assert.equal(result.usersSkipped, 1);
    assert.equal(result.digestsSent, 0);
    assert.equal(recorder.calls.length, 0);

    const row = await db.notification.findFirstOrThrow({
        where: { sourceId: "job_inactive" },
    });
    assert.equal(row.emailSentAt, null);
});

// ============================================
// Empty case
// ============================================

test("digest with nothing eligible is a no-op", async () => {
    await clearNotifications();

    const recorder = makeRecorder();
    const result = await sendDailyDigests(new Date(), { send: recorder.send });

    assert.equal(result.tenantsProcessed, 0);
    assert.equal(result.usersAttempted, 0);
    assert.equal(result.digestsSent, 0);
    assert.equal(recorder.calls.length, 0);
});
