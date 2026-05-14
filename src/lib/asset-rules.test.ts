import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type { FieldDefinition } from "./validations";

const require = createRequire(import.meta.url);
const {
    assertAssetCreateStatusAllowed,
    normalizeAssetImportRowForCreate,
    validateAssetImportRowForCreate,
} = require("./asset-rules.ts") as typeof import("./asset-rules");

const categoryId = "ckw4iif1e000001l2d92gb7rd";

const fieldSchema: FieldDefinition[] = [
    {
        key: "poNumber",
        label: "PO Number",
        type: "text",
        required: true,
    },
    {
        key: "seatCount",
        label: "Seat Count",
        type: "number",
        required: false,
    },
    {
        key: "managed",
        label: "Managed",
        type: "boolean",
        required: false,
    },
    {
        key: "platform",
        label: "Platform",
        type: "select",
        required: false,
        options: ["macOS", "Windows"],
    },
];

test("normalizeAssetImportRowForCreate uses shared create and custom-field rules", () => {
    const normalized = normalizeAssetImportRowForCreate({
        categoryId,
        fieldSchema,
        row: {
            name: "  Laptop  ",
            serialNumber: " SN-100 ",
            assetTag: " TAG-100 ",
            status: "retired",
            condition: "excellent",
            location: " HQ ",
            purchasePrice: "1200",
            purchaseDate: "2026-05-14",
            notes: "  Imported from CSV  ",
            "PO Number": " PO-100 ",
            "Seat Count": "25",
            Managed: "true",
            Platform: "macOS",
        },
    });

    assert.equal(normalized.name, "Laptop");
    assert.equal(normalized.serialNumber, "SN-100");
    assert.equal(normalized.assetTag, "TAG-100");
    assert.equal(normalized.status, "RETIRED");
    assert.equal(normalized.condition, "EXCELLENT");
    assert.equal(normalized.location, "HQ");
    assert.equal(normalized.purchasePrice, 1200);
    assert.equal(normalized.purchaseDate?.toISOString(), "2026-05-14T00:00:00.000Z");
    assert.equal(normalized.notes, "Imported from CSV");
    assert.deepEqual(normalized.customFields, {
        poNumber: "PO-100",
        seatCount: 25,
        managed: true,
        platform: "macOS",
    });
    assert.equal("archivedAt" in normalized, false);
});

test("import create rules reject assigned assets with the shared create invariant", () => {
    const result = validateAssetImportRowForCreate({
        categoryId,
        fieldSchema,
        row: {
            name: "Laptop",
            status: "ASSIGNED",
            "PO Number": "PO-100",
        },
    });

    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [
        "Bulk import cannot create assigned assets. Import them as AVAILABLE and use assign afterward.",
    ]);

    assert.throws(
        () => assertAssetCreateStatusAllowed("ASSIGNED"),
        /Use the assign action after creating an asset/
    );
});

test("import create rules validate custom fields through the shared normalizer", () => {
    const result = validateAssetImportRowForCreate({
        categoryId,
        fieldSchema,
        row: {
            name: "Laptop",
            "PO Number": "PO-100",
            Managed: "yes",
        },
    });

    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, ["Managed must be true or false"]);
});

test("import create rules also enforce base create constraints", () => {
    const result = validateAssetImportRowForCreate({
        categoryId,
        fieldSchema,
        row: {
            name: "Laptop",
            purchasePrice: "-1",
            "PO Number": "PO-100",
        },
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /greater than 0|too small/i);
});
