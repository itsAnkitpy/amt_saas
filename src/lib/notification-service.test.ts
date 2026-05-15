import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildDedupeKey, computeVisibilityFlags, resolveRecipientsForType } = require(
    "./notification-service.ts",
) as typeof import("./notification-service");

type FakeUser = {
    id: string;
    tenantId: string | null;
    role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";
    isActive: boolean;
};

type ResolverClient = Parameters<typeof resolveRecipientsForType>[2];

function makeUserClient(users: FakeUser[]): ResolverClient {
    return {
        user: {
            findMany: async ({ where, select: _select }: { where: { tenantId: string; isActive: boolean; OR: Array<{ role?: { in: string[] } } | { id: string }> }; select?: unknown }) => {
                return users
                    .filter((u) => u.tenantId === where.tenantId && u.isActive === where.isActive)
                    .filter((u) => where.OR.some((clause) => {
                        if ("role" in clause && clause.role) return clause.role.in.includes(u.role);
                        if ("id" in clause && clause.id) return u.id === clause.id;
                        return false;
                    }))
                    .map((u) => ({ id: u.id }));
            },
            findFirst: async ({ where }: { where: { id: string; tenantId: string; isActive: boolean } }) => {
                const found = users.find(
                    (u) =>
                        u.id === where.id &&
                        u.tenantId === where.tenantId &&
                        u.isActive === where.isActive,
                );
                return found ? { id: found.id } : null;
            },
        },
    } as unknown as ResolverClient;
}

// ============================================
// buildDedupeKey
// ============================================

test("buildDedupeKey: MAINTENANCE_OVERDUE uses job:<jobId>", () => {
    assert.equal(buildDedupeKey("MAINTENANCE_OVERDUE", "job_abc"), "job:job_abc");
});

test("buildDedupeKey: MAINTENANCE_DUE_SOON uses job:<jobId>", () => {
    assert.equal(buildDedupeKey("MAINTENANCE_DUE_SOON", "job_xyz"), "job:job_xyz");
});

test("buildDedupeKey: ASSET_ASSIGNED_TO_YOU uses assignment:<assignmentId>", () => {
    assert.equal(
        buildDedupeKey("ASSET_ASSIGNED_TO_YOU", "asgmt_1"),
        "assignment:asgmt_1",
    );
});

test("buildDedupeKey: WARRANTY_EXPIRING includes warranty ISO date suffix", () => {
    assert.equal(
        buildDedupeKey("WARRANTY_EXPIRING", "asset_42", "2026-12-31"),
        "asset:asset_42:2026-12-31",
    );
});

test("buildDedupeKey: WARRANTY_EXPIRING without suffix throws", () => {
    assert.throws(
        () => buildDedupeKey("WARRANTY_EXPIRING", "asset_42"),
        /WARRANTY_EXPIRING requires a suffix/,
    );
});

test("buildDedupeKey: empty sourceId throws", () => {
    assert.throws(
        () => buildDedupeKey("ASSET_ASSIGNED_TO_YOU", ""),
        /sourceId is required/,
    );
});

test("buildDedupeKey: warranty key changes when date changes (re-fire behavior)", () => {
    const before = buildDedupeKey("WARRANTY_EXPIRING", "asset_1", "2026-01-01");
    const after = buildDedupeKey("WARRANTY_EXPIRING", "asset_1", "2027-06-15");
    assert.notEqual(before, after);
});

// ============================================
// computeVisibilityFlags
// ============================================

test("computeVisibilityFlags: both channels enabled -> row visible everywhere", () => {
    const flags = computeVisibilityFlags({ inApp: true, email: true });
    assert.deepEqual(flags, {
        inAppVisible: true,
        emailEligible: true,
        allDisabled: false,
    });
});

test("computeVisibilityFlags: only email enabled -> inApp hidden, email eligible", () => {
    const flags = computeVisibilityFlags({ inApp: false, email: true });
    assert.equal(flags.inAppVisible, false);
    assert.equal(flags.emailEligible, true);
    assert.equal(flags.allDisabled, false);
});

test("computeVisibilityFlags: only in-app enabled -> email not eligible", () => {
    const flags = computeVisibilityFlags({ inApp: true, email: false });
    assert.equal(flags.inAppVisible, true);
    assert.equal(flags.emailEligible, false);
    assert.equal(flags.allDisabled, false);
});

test("computeVisibilityFlags: both disabled -> allDisabled true (caller skips insert)", () => {
    const flags = computeVisibilityFlags({ inApp: false, email: false });
    assert.equal(flags.allDisabled, true);
});

// ============================================
// resolveRecipientsForType
// ============================================

const TENANT = "t1";
const usersFixture: FakeUser[] = [
    { id: "admin_a", tenantId: TENANT, role: "ADMIN", isActive: true },
    { id: "mgr_a", tenantId: TENANT, role: "MANAGER", isActive: true },
    { id: "user_a", tenantId: TENANT, role: "USER", isActive: true },
    { id: "admin_inactive", tenantId: TENANT, role: "ADMIN", isActive: false },
    { id: "admin_other", tenantId: "t2", role: "ADMIN", isActive: true },
    { id: "super", tenantId: null, role: "SUPER_ADMIN", isActive: true },
];

test("resolveRecipientsForType: DUE_SOON returns active ADMIN+MANAGER of tenant only", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_DUE_SOON",
        { tenantId: TENANT },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
});

test("resolveRecipientsForType: WARRANTY_EXPIRING returns active ADMIN+MANAGER of tenant only", async () => {
    const ids = await resolveRecipientsForType(
        "WARRANTY_EXPIRING",
        { tenantId: TENANT },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
});

test("resolveRecipientsForType: OVERDUE without assignee returns ADMIN+MANAGER only", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: null },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
});

test("resolveRecipientsForType: OVERDUE with USER assignee adds them to ADMIN+MANAGER set", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: "user_a" },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a", "user_a"]);
});

test("resolveRecipientsForType: OVERDUE assignee already in ADMIN set -> no duplicate", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: "admin_a" },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
});

test("resolveRecipientsForType: inactive ADMIN never receives", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_DUE_SOON",
        { tenantId: TENANT },
        makeUserClient(usersFixture),
    );
    assert.ok(!ids.includes("admin_inactive"));
});

test("resolveRecipientsForType: cross-tenant ADMIN never receives", async () => {
    const ids = await resolveRecipientsForType(
        "MAINTENANCE_DUE_SOON",
        { tenantId: TENANT },
        makeUserClient(usersFixture),
    );
    assert.ok(!ids.includes("admin_other"));
});

test("resolveRecipientsForType: ASSIGNED_TO_YOU returns the assignee only", async () => {
    const ids = await resolveRecipientsForType(
        "ASSET_ASSIGNED_TO_YOU",
        { tenantId: TENANT, assigneeId: "user_a" },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids, ["user_a"]);
});

test("resolveRecipientsForType: ASSIGNED_TO_YOU with no assignee returns []", async () => {
    const ids = await resolveRecipientsForType(
        "ASSET_ASSIGNED_TO_YOU",
        { tenantId: TENANT },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids, []);
});

test("resolveRecipientsForType: ASSIGNED_TO_YOU with inactive assignee returns []", async () => {
    const ids = await resolveRecipientsForType(
        "ASSET_ASSIGNED_TO_YOU",
        { tenantId: TENANT, assigneeId: "admin_inactive" },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids, []);
});

test("resolveRecipientsForType: ASSIGNED_TO_YOU with cross-tenant id returns []", async () => {
    const ids = await resolveRecipientsForType(
        "ASSET_ASSIGNED_TO_YOU",
        { tenantId: TENANT, assigneeId: "admin_other" },
        makeUserClient(usersFixture),
    );
    assert.deepEqual(ids, []);
});
