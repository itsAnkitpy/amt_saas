import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { BulkActionSchema, ImportExecuteSchema } = require("./asset.ts") as typeof import("./asset");

test("BulkActionSchema accepts restore as a supported asset bulk action", () => {
    const parsed = BulkActionSchema.parse({
        action: "restore",
        assetIds: ["ck1234567890123456789012"],
    });

    assert.equal(parsed.action, "restore");
});

test("ImportExecuteSchema preserves __rowNumber so execute can report the original CSV row", () => {
    const parsed = ImportExecuteSchema.parse({
        categoryId: "ck1234567890123456789012",
        rows: [
            {
                name: "Laptop",
                serialNumber: "SN-100",
                __rowNumber: 18,
            },
        ],
    });

    assert.equal(parsed.rows[0].__rowNumber, 18);
});
