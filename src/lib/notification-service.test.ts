import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildDedupeKey, computeVisibilityFlags } = require(
    "./notification-service.ts",
) as typeof import("./notification-service");

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
