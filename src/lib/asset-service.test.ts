import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type { FieldDefinition } from "./validations";

const require = createRequire(import.meta.url);
const { validateAndNormalizeCustomFields } = require("./asset-service.ts") as typeof import("./asset-service");

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
    {
        key: "goLive",
        label: "Go Live",
        type: "date",
        required: false,
    },
];

test("validateAndNormalizeCustomFields trims and normalizes schema-backed values", () => {
    const normalized = validateAndNormalizeCustomFields(
        {
            poNumber: "  PO-1001  ",
            seatCount: "25",
            managed: "true",
            platform: "macOS",
            goLive: "2026-04-22",
            ignored: "should not be kept",
        },
        fieldSchema
    );

    assert.deepEqual(normalized, {
        poNumber: "PO-1001",
        seatCount: 25,
        managed: true,
        platform: "macOS",
        goLive: "2026-04-22",
    });
});

test("validateAndNormalizeCustomFields enforces required fields", () => {
    assert.throws(
        () =>
            validateAndNormalizeCustomFields(
                {
                    seatCount: "12",
                },
                fieldSchema
            ),
        /PO Number is required/
    );
});

test("validateAndNormalizeCustomFields rejects invalid boolean values", () => {
    assert.throws(
        () =>
            validateAndNormalizeCustomFields(
                {
                    poNumber: "PO-1002",
                    managed: "yes",
                },
                fieldSchema
            ),
        /Managed must be true or false/
    );
});
