import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { after } from "node:test";

const require = createRequire(import.meta.url);
const { db } = require("./db.ts") as typeof import("./db");
const { handleUserDeleted } =
    require("./user-lifecycle.ts") as typeof import("./user-lifecycle");

// Integration tests for user-deletion cleanup against a real Postgres DB.
// Verifies: an abandoned signup (no row) is a safe no-op; deleting a workspace's
// only active admin deactivates it; deleting one of several active admins leaves
// it active; an inactive co-admin does not count as cover.

const RUN_ID = `ul-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeTenant(suffix: string) {
    return db.tenant.create({
        data: {
            name: `Acme ${RUN_ID} ${suffix}`,
            slug: `${RUN_ID}-${suffix}`,
            plan: "FREE",
        },
    });
}

async function makeAdmin(tenantId: string, suffix: string, isActive = true) {
    return db.user.create({
        data: {
            id: `${RUN_ID}-${suffix}`,
            email: `${suffix}-${RUN_ID}@test.local`,
            firstName: "Ada",
            role: "ADMIN",
            isActive,
            tenantId,
        },
    });
}

after(async () => {
    // Deleting the tenants cascades their users; the extra deleteMany catches any
    // stragglers (and the always-orphan ghost id never creates a row).
    await db.tenant.deleteMany({ where: { slug: { startsWith: RUN_ID } } });
    await db.user.deleteMany({ where: { id: { startsWith: RUN_ID } } });
    await db.$disconnect();
});

test("an abandoned signup with no DB row is a safe no-op", async () => {
    const outcome = await handleUserDeleted(`${RUN_ID}-ghost`);
    assert.deepEqual(outcome, { deleted: false });
});

test("deleting a workspace's only admin deactivates the workspace", async () => {
    const tenant = await makeTenant("solo");
    const admin = await makeAdmin(tenant.id, "solo-a");

    const outcome = await handleUserDeleted(admin.id);
    assert.deepEqual(outcome, {
        deleted: true,
        deactivatedTenantId: tenant.id,
    });

    const reloaded = await db.tenant.findUnique({ where: { id: tenant.id } });
    assert.equal(reloaded?.isActive, false);
    const goneUser = await db.user.findUnique({ where: { id: admin.id } });
    assert.equal(goneUser, null);
});

test("deleting one of several active admins leaves the workspace active", async () => {
    const tenant = await makeTenant("multi");
    const adminA = await makeAdmin(tenant.id, "multi-a");
    const adminB = await makeAdmin(tenant.id, "multi-b");

    const outcome = await handleUserDeleted(adminA.id);
    assert.deepEqual(outcome, { deleted: true, deactivatedTenantId: null });

    const reloaded = await db.tenant.findUnique({ where: { id: tenant.id } });
    assert.equal(reloaded?.isActive, true);
    const survivor = await db.user.findUnique({ where: { id: adminB.id } });
    assert.ok(survivor);
});

test("an inactive co-admin is not cover — the workspace still deactivates", async () => {
    const tenant = await makeTenant("inact");
    const activeAdmin = await makeAdmin(tenant.id, "inact-a", true);
    await makeAdmin(tenant.id, "inact-b", false); // deactivated admin — no cover

    const outcome = await handleUserDeleted(activeAdmin.id);
    assert.deepEqual(outcome, {
        deleted: true,
        deactivatedTenantId: tenant.id,
    });

    const reloaded = await db.tenant.findUnique({ where: { id: tenant.id } });
    assert.equal(reloaded?.isActive, false);
});
