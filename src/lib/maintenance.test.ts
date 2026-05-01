import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    addMaintenanceInterval,
    formatMaintenanceInterval,
    getMaintenanceAttentionState,
    getTenantMaintenanceAttentionSummary,
    getMaintenanceDueSoonRange,
} = require("./maintenance.ts") as typeof import("./maintenance");

test("addMaintenanceInterval advances from the actual completion date", () => {
    const completedAt = new Date("2026-04-23T10:00:00.000Z");

    assert.equal(
        addMaintenanceInterval(completedAt, 3, "MONTHS").toISOString(),
        "2026-07-23T10:00:00.000Z"
    );
    assert.equal(
        addMaintenanceInterval(completedAt, 14, "DAYS").toISOString(),
        "2026-05-07T10:00:00.000Z"
    );
});

test("getMaintenanceDueSoonRange covers today through the next 7 calendar days", () => {
    const { start, end } = getMaintenanceDueSoonRange(
        new Date("2026-04-23T10:00:00.000Z")
    );

    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 3);
    assert.equal(start.getDate(), 23);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);

    assert.equal(end.getFullYear(), 2026);
    assert.equal(end.getMonth(), 3);
    assert.equal(end.getDate(), 30);
    assert.equal(end.getHours(), 23);
    assert.equal(end.getMinutes(), 59);
});

test("formatMaintenanceInterval returns a readable label", () => {
    assert.equal(formatMaintenanceInterval(1, "YEARS"), "Every 1 year");
    assert.equal(formatMaintenanceInterval(6, "MONTHS"), "Every 6 months");
});

test("getMaintenanceAttentionState marks open jobs before today as overdue", () => {
    const baseDate = new Date("2026-04-23T10:00:00.000Z");
    const { start } = getMaintenanceDueSoonRange(baseDate);
    const attention = getMaintenanceAttentionState(
        {
            status: "OPEN",
            dueAt: new Date(start.getTime() - 1),
        },
        baseDate
    );

    assert.equal(attention, "overdue");
});

test("getMaintenanceAttentionState marks open jobs due today or within 7 days as dueSoon", () => {
    const baseDate = new Date("2026-04-23T10:00:00.000Z");
    const { start, end } = getMaintenanceDueSoonRange(baseDate);

    assert.equal(
        getMaintenanceAttentionState(
            {
                status: "OPEN",
                dueAt: start,
            },
            baseDate
        ),
        "dueSoon"
    );

    assert.equal(
        getMaintenanceAttentionState(
            {
                status: "OPEN",
                dueAt: end,
            },
            baseDate
        ),
        "dueSoon"
    );
});

test("getMaintenanceAttentionState ignores later open jobs", () => {
    const baseDate = new Date("2026-04-23T10:00:00.000Z");
    const { end } = getMaintenanceDueSoonRange(baseDate);
    const attention = getMaintenanceAttentionState(
        {
            status: "OPEN",
            dueAt: new Date(end.getTime() + 1),
        },
        baseDate
    );

    assert.equal(attention, "none");
});

test("getMaintenanceAttentionState ignores non-open jobs", () => {
    const baseDate = new Date("2026-04-23T10:00:00.000Z");
    const { start } = getMaintenanceDueSoonRange(baseDate);

    assert.equal(
        getMaintenanceAttentionState(
            {
                status: "IN_PROGRESS",
                dueAt: new Date(start.getTime() - 1),
            },
            baseDate
        ),
        "none"
    );
    assert.equal(
        getMaintenanceAttentionState(
            {
                status: "COMPLETED",
                dueAt: start,
            },
            baseDate
        ),
        "none"
    );
    assert.equal(
        getMaintenanceAttentionState(
            {
                status: "CANCELLED",
                dueAt: start,
            },
            baseDate
        ),
        "none"
    );
});

test("getTenantMaintenanceAttentionSummary counts only open tenant jobs on active assets", async () => {
    const receivedWhere: unknown[] = [];
    const baseDate = new Date("2026-04-23T10:00:00.000Z");
    const { start, end } = getMaintenanceDueSoonRange(baseDate);

    const fakeClient = {
        maintenanceJob: {
            count: async (args: { where: unknown }) => {
                receivedWhere.push(args.where);
                return receivedWhere.length === 1 ? 2 : 3;
            },
        },
    };

    const summary = await getTenantMaintenanceAttentionSummary(
        "tenant_123",
        baseDate,
        fakeClient as unknown as Parameters<
            typeof getTenantMaintenanceAttentionSummary
        >[2]
    );

    assert.deepEqual(summary, {
        overdueCount: 2,
        dueSoonCount: 3,
        attentionCount: 5,
    });

    assert.deepEqual(receivedWhere[0], {
        asset: {
            tenantId: "tenant_123",
            archivedAt: null,
        },
        status: "OPEN",
        dueAt: {
            lt: start,
        },
    });

    assert.deepEqual(receivedWhere[1], {
        asset: {
            tenantId: "tenant_123",
            archivedAt: null,
        },
        status: "OPEN",
        dueAt: {
            gte: start,
            lte: end,
        },
    });
});
