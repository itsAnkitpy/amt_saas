import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    formatActivityDetails,
    getActivityActionLabel,
} = require("./activity-format.ts") as typeof import("./activity-format");

test("activity action label presents archived instead of deleted", () => {
    assert.equal(getActivityActionLabel("DELETED"), "archived");
    assert.equal(getActivityActionLabel("DELETED", "title"), "Archived");
});

test("status change activity shows readable from and to status", () => {
    assert.equal(
        formatActivityDetails("STATUS_CHANGED", {
            from: "AVAILABLE",
            to: "RETIRED",
        }),
        "from Available to Retired"
    );
});

test("status change activity includes other changed fields plainly", () => {
    assert.equal(
        formatActivityDetails("STATUS_CHANGED", {
            from: "AVAILABLE",
            to: "MAINTENANCE",
            fields: ["customFields"],
        }),
        "from Available to Maintenance; also updated custom fields"
    );
});

test("updated activity formats changed fields without raw field names", () => {
    assert.equal(
        formatActivityDetails("UPDATED", {
            fields: ["assetTag", "customFields"],
        }),
        "asset tag and custom fields"
    );
});
