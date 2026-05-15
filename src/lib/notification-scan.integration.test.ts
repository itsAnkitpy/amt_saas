import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { after, before } from "node:test";

const require = createRequire(import.meta.url);

// IMPORTANT: import ./db.ts first — Prisma's runtime loads .env into
// process.env on first require, which env.ts depends on.
const { db } = require("./db.ts") as typeof import("./db");
const {
    scanDueSoonMaintenance,
    scanExpiringWarranties,
    scanOverdueMaintenance,
} = require("./notification-scan.ts") as typeof import("./notification-scan");
const { env } = require("./env.ts") as typeof import("./env");
const { GET: cronGet } = require(
    "../app/api/cron/notifications/daily/route.ts",
) as typeof import("../app/api/cron/notifications/daily/route");

// Integration tests for M2 cron scans against a real Postgres DB.
// Seeds two tenants, multiple users with different roles, and varied
// maintenance / warranty fixtures. Asserts recipient-fan-out, dedupe,
// re-fire on warranty date change, tenant isolation, and skip cases.

const RUN_ID = `m2-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const tenantA = {
    id: `tn_${RUN_ID}_a`,
    slug: `tn-${RUN_ID}-a`,
    name: "Tenant A (scan test)",
};
const tenantB = {
    id: `tn_${RUN_ID}_b`,
    slug: `tn-${RUN_ID}-b`,
    name: "Tenant B (scan test)",
};
const tenantInactive = {
    id: `tn_${RUN_ID}_inactive`,
    slug: `tn-${RUN_ID}-inactive`,
    name: "Tenant inactive (scan test)",
};

const admin = { id: `usr_${RUN_ID}_admin`, email: `admin-${RUN_ID}@test.local` };
const manager = { id: `usr_${RUN_ID}_mgr`, email: `mgr-${RUN_ID}@test.local` };
const plainUser = { id: `usr_${RUN_ID}_user`, email: `user-${RUN_ID}@test.local` };
const inactiveAdmin = {
    id: `usr_${RUN_ID}_admininact`,
    email: `inact-${RUN_ID}@test.local`,
};

const adminB = { id: `usr_${RUN_ID}_b_admin`, email: `bad-${RUN_ID}@test.local` };
const adminInactiveT = {
    id: `usr_${RUN_ID}_it_admin`,
    email: `itad-${RUN_ID}@test.local`,
};

const categoryA = `cat_${RUN_ID}_a`;
const categoryB = `cat_${RUN_ID}_b`;
const categoryInact = `cat_${RUN_ID}_inact`;
const scheduleA = `sch_${RUN_ID}_a`;
const scheduleB = `sch_${RUN_ID}_b`;
const scheduleArch = `sch_${RUN_ID}_arch`;
const scheduleInact = `sch_${RUN_ID}_inact`;

const assetOverdue = `as_${RUN_ID}_overdue`;
const assetDueSoon = `as_${RUN_ID}_duesoon`;
const assetWarranty = `as_${RUN_ID}_warranty`;
const assetArchived = `as_${RUN_ID}_archived`;
const assetCrossTenant = `as_${RUN_ID}_xtenant`;
const assetInactiveTenant = `as_${RUN_ID}_inact_t`;
const assetFuture = `as_${RUN_ID}_future`;

const jobOverdue = `job_${RUN_ID}_overdue`;
const jobDueSoon = `job_${RUN_ID}_duesoon`;
const jobArchived = `job_${RUN_ID}_arch`;
const jobCrossTenant = `job_${RUN_ID}_xtenant`;
const jobInactiveTenant = `job_${RUN_ID}_inact_t`;
const jobFuture = `job_${RUN_ID}_future`;

const FROZEN_NOW = new Date("2026-05-15T12:00:00.000Z");

function daysAgo(d: Date, n: number): Date {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() - n);
    return x;
}
function daysAhead(d: Date, n: number): Date {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
}

async function seed() {
    await db.tenant.createMany({
        data: [
            { id: tenantA.id, slug: tenantA.slug, name: tenantA.name, isActive: true },
            { id: tenantB.id, slug: tenantB.slug, name: tenantB.name, isActive: true },
            {
                id: tenantInactive.id,
                slug: tenantInactive.slug,
                name: tenantInactive.name,
                isActive: false,
            },
        ],
    });

    await db.user.createMany({
        data: [
            { id: admin.id, email: admin.email, firstName: "Adm", tenantId: tenantA.id, role: "ADMIN" },
            { id: manager.id, email: manager.email, firstName: "Mgr", tenantId: tenantA.id, role: "MANAGER" },
            { id: plainUser.id, email: plainUser.email, firstName: "Usr", tenantId: tenantA.id, role: "USER" },
            { id: inactiveAdmin.id, email: inactiveAdmin.email, firstName: "Inact", tenantId: tenantA.id, role: "ADMIN", isActive: false },
            { id: adminB.id, email: adminB.email, firstName: "AdmB", tenantId: tenantB.id, role: "ADMIN" },
            { id: adminInactiveT.id, email: adminInactiveT.email, firstName: "AdmIT", tenantId: tenantInactive.id, role: "ADMIN" },
        ],
    });

    await db.assetCategory.createMany({
        data: [
            { id: categoryA, name: `Cat A ${RUN_ID}`, fieldSchema: [], tenantId: tenantA.id },
            { id: categoryB, name: `Cat B ${RUN_ID}`, fieldSchema: [], tenantId: tenantB.id },
            { id: categoryInact, name: `Cat Inact ${RUN_ID}`, fieldSchema: [], tenantId: tenantInactive.id },
        ],
    });

    // Warranty asset: warrantyEnd 10 days ahead -> in 30d window
    await db.asset.createMany({
        data: [
            // Overdue maintenance asset, assigned to plainUser
            {
                id: assetOverdue,
                name: "Overdue Asset",
                tenantId: tenantA.id,
                categoryId: categoryA,
                assignedToId: plainUser.id,
            },
            // Due-soon maintenance asset, no assignee
            {
                id: assetDueSoon,
                name: "Due-Soon Asset",
                tenantId: tenantA.id,
                categoryId: categoryA,
            },
            // Warranty expiring 10 days out
            {
                id: assetWarranty,
                name: "Warranty Asset",
                tenantId: tenantA.id,
                categoryId: categoryA,
                warrantyEnd: daysAhead(FROZEN_NOW, 10),
            },
            // Archived asset with overdue job -> must be skipped
            {
                id: assetArchived,
                name: "Archived Asset",
                tenantId: tenantA.id,
                categoryId: categoryA,
                archivedAt: daysAgo(FROZEN_NOW, 5),
            },
            // Cross-tenant overdue job
            {
                id: assetCrossTenant,
                name: "Tenant B Asset",
                tenantId: tenantB.id,
                categoryId: categoryB,
            },
            // Inactive tenant -> skipped
            {
                id: assetInactiveTenant,
                name: "Inactive Tenant Asset",
                tenantId: tenantInactive.id,
                categoryId: categoryInact,
            },
            // Future maintenance (outside 7-day window) -> not due-soon
            {
                id: assetFuture,
                name: "Future Asset",
                tenantId: tenantA.id,
                categoryId: categoryA,
            },
        ],
    });

    await db.assetMaintenanceSchedule.createMany({
        data: [
            { id: scheduleA, assetId: assetOverdue, intervalValue: 1, intervalUnit: "MONTHS" },
            { id: scheduleB, assetId: assetDueSoon, intervalValue: 1, intervalUnit: "MONTHS" },
            { id: scheduleArch, assetId: assetArchived, intervalValue: 1, intervalUnit: "MONTHS" },
            { id: `${scheduleA}_x`, assetId: assetCrossTenant, intervalValue: 1, intervalUnit: "MONTHS" },
            { id: scheduleInact, assetId: assetInactiveTenant, intervalValue: 1, intervalUnit: "MONTHS" },
            { id: `${scheduleA}_f`, assetId: assetFuture, intervalValue: 1, intervalUnit: "MONTHS" },
        ],
    });

    await db.maintenanceJob.createMany({
        data: [
            // 5 days overdue
            { id: jobOverdue, assetId: assetOverdue, scheduleId: scheduleA, status: "OPEN", dueAt: daysAgo(FROZEN_NOW, 5) },
            // Due in 3 days (due-soon window)
            { id: jobDueSoon, assetId: assetDueSoon, scheduleId: scheduleB, status: "OPEN", dueAt: daysAhead(FROZEN_NOW, 3) },
            // Archived asset, also overdue -> skip
            { id: jobArchived, assetId: assetArchived, scheduleId: scheduleArch, status: "OPEN", dueAt: daysAgo(FROZEN_NOW, 2) },
            // Tenant B overdue
            { id: jobCrossTenant, assetId: assetCrossTenant, scheduleId: `${scheduleA}_x`, status: "OPEN", dueAt: daysAgo(FROZEN_NOW, 2) },
            // Inactive tenant overdue -> skip
            { id: jobInactiveTenant, assetId: assetInactiveTenant, scheduleId: scheduleInact, status: "OPEN", dueAt: daysAgo(FROZEN_NOW, 2) },
            // Future-dated -> not in either window
            { id: jobFuture, assetId: assetFuture, scheduleId: `${scheduleA}_f`, status: "OPEN", dueAt: daysAhead(FROZEN_NOW, 30) },
        ],
    });
}

async function clearNotifications() {
    await db.notification.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id, tenantInactive.id] } },
    });
}

async function cleanup() {
    // Cascade from Tenant removes notifications, prefs, assets, jobs, users,
    // and categories (each category cascade-deletes with its tenant).
    await db.tenant.deleteMany({
        where: { id: { in: [tenantA.id, tenantB.id, tenantInactive.id] } },
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

// ============================================
// Overdue scan
// ============================================

test("scanOverdueMaintenance: notifies ADMIN, MANAGER, and assignee USER", async () => {
    await clearNotifications();
    const result = await scanOverdueMaintenance(FROZEN_NOW);

    assert.equal(result.failed, 0);

    // Archived asset + inactive tenant must produce ZERO notifications.
    const skipRows = await db.notification.findMany({
        where: { OR: [{ sourceId: jobArchived }, { sourceId: jobInactiveTenant }] },
        select: { sourceId: true, userId: true, tenantId: true },
    });
    assert.deepEqual(skipRows, [], "no notifications should be created for archived/inactive-tenant jobs");

    // Tenant A overdue: admin + manager + plainUser = 3 rows
    const aRows = await db.notification.findMany({
        where: { tenantId: tenantA.id, type: "MAINTENANCE_OVERDUE", sourceId: jobOverdue },
        select: { userId: true },
    });
    assert.deepEqual(
        aRows.map((r) => r.userId).sort(),
        [admin.id, manager.id, plainUser.id].sort(),
    );

    // Tenant B overdue (no assignee): adminB only
    const bRows = await db.notification.findMany({
        where: { tenantId: tenantB.id, type: "MAINTENANCE_OVERDUE" },
        select: { userId: true },
    });
    assert.deepEqual(bRows.map((r) => r.userId), [adminB.id]);

    // Inactive admin in tenant A receives nothing
    const inactiveRows = await db.notification.findMany({
        where: { userId: inactiveAdmin.id },
    });
    assert.equal(inactiveRows.length, 0);
});

test("scanOverdueMaintenance: second run is a no-op (dedupe)", async () => {
    // Notifications from prior test still exist — call again, expect 0 new rows.
    const before = await db.notification.count({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    const result = await scanOverdueMaintenance(FROZEN_NOW);
    const after = await db.notification.count({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    assert.equal(after, before, "no new rows on second run");
    assert.equal(result.created, 0);
    assert.ok(result.skipped > 0, "dedupe skips counted");
});

// ============================================
// Due-soon scan
// ============================================

test("scanDueSoonMaintenance: notifies ADMIN+MANAGER only, NOT plain USER", async () => {
    await clearNotifications();
    const result = await scanDueSoonMaintenance(FROZEN_NOW);

    assert.ok(result.processed >= 1);
    assert.equal(result.failed, 0);

    const rows = await db.notification.findMany({
        where: { tenantId: tenantA.id, type: "MAINTENANCE_DUE_SOON", sourceId: jobDueSoon },
        select: { userId: true },
    });
    assert.deepEqual(rows.map((r) => r.userId).sort(), [admin.id, manager.id].sort());

    // Plain user never receives DUE_SOON (no assignee fan-out for this type)
    const userRow = await db.notification.findFirst({
        where: { userId: plainUser.id, type: "MAINTENANCE_DUE_SOON" },
    });
    assert.equal(userRow, null);

    // Future job (>7 days) not picked up
    const futureRow = await db.notification.findFirst({
        where: { sourceId: jobFuture },
    });
    assert.equal(futureRow, null);
});

// ============================================
// Warranty scan
// ============================================

test("scanExpiringWarranties: notifies ADMIN+MANAGER tenant-wide", async () => {
    await clearNotifications();
    const result = await scanExpiringWarranties(FROZEN_NOW);

    assert.equal(result.processed, 1);
    assert.equal(result.failed, 0);

    const rows = await db.notification.findMany({
        where: { tenantId: tenantA.id, type: "WARRANTY_EXPIRING", sourceId: assetWarranty },
        select: { userId: true, dedupeKey: true },
    });
    assert.deepEqual(rows.map((r) => r.userId).sort(), [admin.id, manager.id].sort());

    // Dedupe key includes the warranty ISO date
    const isoDate = daysAhead(FROZEN_NOW, 10).toISOString().slice(0, 10);
    assert.ok(rows[0].dedupeKey.endsWith(isoDate), `dedupeKey ${rows[0].dedupeKey} should end with ${isoDate}`);
});

// ============================================
// Cron route auth + happy path
// ============================================

test("cron route: missing Authorization header -> 401", async () => {
    const res = await cronGet(new Request("http://localhost/api/cron/notifications/daily"));
    assert.equal(res.status, 401);
});

test("cron route: wrong bearer token -> 401", async () => {
    const res = await cronGet(
        new Request("http://localhost/api/cron/notifications/daily", {
            headers: { authorization: "Bearer wrong-token" },
        }),
    );
    assert.equal(res.status, 401);
});

test("cron route: valid bearer returns ok=true with scan result shape", async () => {
    const res = await cronGet(
        new Request("http://localhost/api/cron/notifications/daily", {
            headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
        ok: boolean;
        durationMs: number;
        results: {
            overdue: { processed: number; created: number; skipped: number; failed: number };
            dueSoon: { processed: number; created: number; skipped: number; failed: number };
            warranty: { processed: number; created: number; skipped: number; failed: number };
        };
    };
    assert.equal(body.ok, true);
    assert.ok(typeof body.durationMs === "number");
    for (const key of ["overdue", "dueSoon", "warranty"] as const) {
        const r = body.results[key];
        assert.ok(typeof r.processed === "number", `${key}.processed`);
        assert.ok(typeof r.created === "number", `${key}.created`);
        assert.ok(typeof r.skipped === "number", `${key}.skipped`);
        assert.ok(typeof r.failed === "number", `${key}.failed`);
    }
});

test("scanExpiringWarranties: warranty date change re-fires a NEW row", async () => {
    // Prior test left a row at the original date. Move warrantyEnd; expect new row.
    const newDate = daysAhead(FROZEN_NOW, 20);
    await db.asset.update({
        where: { id: assetWarranty },
        data: { warrantyEnd: newDate },
    });

    const result = await scanExpiringWarranties(FROZEN_NOW);
    assert.equal(result.created, 2, "one new row per ADMIN+MANAGER");

    const rows = await db.notification.findMany({
        where: { tenantId: tenantA.id, sourceId: assetWarranty },
        orderBy: { createdAt: "asc" },
    });
    // 2 old + 2 new = 4 total
    assert.equal(rows.length, 4);

    const keys = Array.from(new Set(rows.map((r) => r.dedupeKey)));
    assert.equal(keys.length, 2, "two distinct dedupe keys (old date + new date)");
});
