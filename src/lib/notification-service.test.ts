import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    buildDedupeKey,
    computeVisibilityFlags,
    resolveRecipientsForType,
    ScanRecipientCache,
} = require(
    "./notification-service.ts",
) as typeof import("./notification-service");

type FakeUser = {
    id: string;
    tenantId: string | null;
    role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";
    isActive: boolean;
};

type ResolverClient = Parameters<typeof resolveRecipientsForType>[2];

type FindManyArgs = {
    where: {
        tenantId: string;
        isActive: boolean;
        OR?: Array<{ role?: { in: string[] } } | { id: string }>;
        role?: { in: string[] };
    };
};

function makeUserClient(
    users: FakeUser[],
    counter?: { findMany: number; findFirst: number },
): ResolverClient {
    return {
        user: {
            findMany: async ({ where }: FindManyArgs) => {
                if (counter) counter.findMany += 1;
                return users
                    .filter(
                        (u) =>
                            u.tenantId === where.tenantId &&
                            u.isActive === where.isActive,
                    )
                    .filter((u) => {
                        if (where.role) return where.role.in.includes(u.role);
                        if (where.OR) {
                            return where.OR.some((clause) => {
                                if ("role" in clause && clause.role)
                                    return clause.role.in.includes(u.role);
                                if ("id" in clause && clause.id)
                                    return u.id === clause.id;
                                return false;
                            });
                        }
                        return true;
                    })
                    .map((u) => ({ id: u.id }));
            },
            findFirst: async ({
                where,
            }: {
                where: { id: string; tenantId: string; isActive: boolean };
            }) => {
                if (counter) counter.findFirst += 1;
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

// ============================================
// ScanRecipientCache
// ============================================

test("ScanRecipientCache: tenant ADMIN+MANAGER set queried only once across N source rows", async () => {
    const counter = { findMany: 0, findFirst: 0 };
    const client = makeUserClient(usersFixture, counter);
    const cache = new ScanRecipientCache(client);

    // Simulate 5 source rows in the same tenant, no assignee (e.g. DUE_SOON).
    for (let i = 0; i < 5; i++) {
        const ids = await resolveRecipientsForType(
            "MAINTENANCE_DUE_SOON",
            { tenantId: TENANT },
            client,
            cache,
        );
        assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
    }

    // Without cache: 5 findMany. With cache: 1.
    assert.equal(counter.findMany, 1, "admin/mgr query runs once per tenant per scan");
    assert.equal(counter.findFirst, 0);
});

test("ScanRecipientCache: OVERDUE with assignee in admin/mgr set adds no extra query", async () => {
    const counter = { findMany: 0, findFirst: 0 };
    const client = makeUserClient(usersFixture, counter);
    const cache = new ScanRecipientCache(client);

    // First call primes the cache.
    await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: "admin_a" },
        client,
        cache,
    );
    // Assignee is already an ADMIN, so no extra findFirst.
    assert.equal(counter.findMany, 1);
    assert.equal(counter.findFirst, 0);
});

test("ScanRecipientCache: OVERDUE with non-admin assignee uses cached findFirst path", async () => {
    const counter = { findMany: 0, findFirst: 0 };
    const client = makeUserClient(usersFixture, counter);
    const cache = new ScanRecipientCache(client);

    const ids = await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: "user_a" },
        client,
        cache,
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a", "user_a"]);
    assert.equal(counter.findMany, 1);
    assert.equal(counter.findFirst, 1, "one targeted assignee validation");
});

test("ScanRecipientCache: invalid assignee is dropped, admin+mgr still returned", async () => {
    const counter = { findMany: 0, findFirst: 0 };
    const client = makeUserClient(usersFixture, counter);
    const cache = new ScanRecipientCache(client);

    const ids = await resolveRecipientsForType(
        "MAINTENANCE_OVERDUE",
        { tenantId: TENANT, assigneeId: "admin_inactive" },
        client,
        cache,
    );
    assert.deepEqual(ids.sort(), ["admin_a", "mgr_a"]);
});
