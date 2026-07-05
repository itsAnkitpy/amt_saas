import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { after } from "node:test";

const require = createRequire(import.meta.url);
const { db } = require("./db.ts") as typeof import("./db");
const { createWorkspace } =
    require("./workspace-service.ts") as typeof import("./workspace-service");

// Integration tests for self-serve workspace provisioning against a real
// Postgres DB. Verifies the create-once guarantee, the slug-collision retry,
// and the "always your own new tenant" isolation invariant — things the
// in-memory unit tests cannot catch.

const RUN_ID = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const NAME = `Acme ${RUN_ID}`;

const ownerA = {
    userId: `usr_${RUN_ID}_a`,
    email: `a-${RUN_ID}@test.local`,
    firstName: "Ada",
    lastName: null as string | null,
};
const ownerB = {
    userId: `usr_${RUN_ID}_b`,
    email: `b-${RUN_ID}@test.local`,
    firstName: "Ben",
    lastName: null as string | null,
};

after(async () => {
    // Cascade removes the owner users via the tenant FK; the extra deleteMany
    // catches any owner row that never got a tenant.
    await db.tenant.deleteMany({ where: { name: NAME } });
    await db.user.deleteMany({
        where: { id: { in: [ownerA.userId, ownerB.userId] } },
    });
    await db.$disconnect();
});

test("createWorkspace creates exactly one tenant + one ADMIN owner", async () => {
    const result = await createWorkspace(ownerA, { name: NAME });
    if (!result.ok) {
        assert.fail(result.error);
    }

    const tenant = await db.tenant.findUnique({ where: { slug: result.slug } });
    assert.ok(tenant);
    assert.equal(tenant.plan, "FREE");
    assert.equal(tenant.name, NAME);

    const user = await db.user.findUnique({ where: { id: ownerA.userId } });
    assert.ok(user);
    assert.equal(user.role, "ADMIN");
    assert.equal(user.tenantId, tenant.id);
    assert.equal(user.isSuperAdmin, false);
});

test("createWorkspace is idempotent — a second call makes no second tenant", async () => {
    const result = await createWorkspace(ownerA, { name: NAME });
    if (!result.ok) {
        assert.fail(result.error);
    }

    const tenantsWithName = await db.tenant.count({ where: { name: NAME } });
    assert.equal(tenantsWithName, 1);
});

test("a colliding company name gets its own new tenant with a -2 slug", async () => {
    const first = await db.tenant.findFirst({ where: { name: NAME } });
    assert.ok(first);

    const result = await createWorkspace(ownerB, { name: NAME });
    if (!result.ok) {
        assert.fail(result.error);
    }
    // The collision retry appended a suffix — B never reused A's slug.
    assert.equal(result.slug, `${first.slug}-2`);

    const userB = await db.user.findUnique({ where: { id: ownerB.userId } });
    assert.ok(userB);
    // Isolation invariant: B always creates its OWN new tenant, never joins A's.
    assert.notEqual(userB.tenantId, first.id);
    assert.equal(userB.role, "ADMIN");
});
