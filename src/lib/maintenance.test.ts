import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    addMaintenanceInterval,
    formatMaintenanceInterval,
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
