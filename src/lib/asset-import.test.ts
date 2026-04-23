import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    buildImportIssueRows,
    filterRowsWithoutErrors,
    findDuplicateIdentifierErrors,
    findExistingIdentifierErrors,
    serializeImportableRows,
    toImportRowContexts,
} = require("./asset-import.ts") as typeof import("./asset-import");

test("toImportRowContexts preserves explicit row numbers and falls back to CSV numbering", () => {
    const rowContexts = toImportRowContexts([
        { name: "Laptop", __rowNumber: 9 },
        { name: "Monitor" },
    ]);

    assert.deepEqual(rowContexts, [
        {
            rowNumber: 9,
            data: { name: "Laptop", __rowNumber: 9 },
        },
        {
            rowNumber: 3,
            data: { name: "Monitor" },
        },
    ]);
});

test("findDuplicateIdentifierErrors trims values and reports the matching row numbers", () => {
    const rowContexts = toImportRowContexts([
        { name: "Laptop", serialNumber: " SN-100 " },
        { name: "Dock", assetTag: "TAG-200" },
        { name: "Laptop Stand", serialNumber: "SN-100" },
        { name: "Monitor", assetTag: " TAG-200 " },
        { name: "Desk", serialNumber: "   ", assetTag: "" },
    ]);

    const errorMap = findDuplicateIdentifierErrors(rowContexts);

    assert.deepEqual(errorMap.get(2), [
        'Duplicate serial number "SN-100" also appears in row(s) 4.',
    ]);
    assert.deepEqual(errorMap.get(4), [
        'Duplicate serial number "SN-100" also appears in row(s) 2.',
    ]);
    assert.deepEqual(errorMap.get(3), [
        'Duplicate asset tag "TAG-200" also appears in row(s) 5.',
    ]);
    assert.deepEqual(errorMap.get(5), [
        'Duplicate asset tag "TAG-200" also appears in row(s) 3.',
    ]);
    assert.equal(errorMap.has(6), false);
});

test("findExistingIdentifierErrors reports active and archived conflicts separately", async () => {
    let receivedWhere: unknown;

    const fakeClient = {
        asset: {
            findMany: async (args: { where: unknown }) => {
                receivedWhere = args.where;

                return [
                    {
                        name: "MacBook Pro",
                        serialNumber: "SN-100",
                        assetTag: null,
                        archivedAt: null,
                    },
                    {
                        name: "Old Dock",
                        serialNumber: null,
                        assetTag: "TAG-200",
                        archivedAt: new Date("2025-01-01T00:00:00.000Z"),
                    },
                ];
            },
        },
    };

    const rowContexts = toImportRowContexts([
        { name: "Laptop", serialNumber: "SN-100" },
        { name: "Dock", assetTag: "TAG-200" },
        { name: "Desk" },
    ]);

    const errorMap = await findExistingIdentifierErrors(
        fakeClient as unknown as Parameters<typeof findExistingIdentifierErrors>[0],
        "tenant_123",
        rowContexts
    );

    assert.deepEqual(receivedWhere, {
        tenantId: "tenant_123",
        OR: [
            { serialNumber: { in: ["SN-100"] } },
            { assetTag: { in: ["TAG-200"] } },
        ],
    });
    assert.deepEqual(errorMap.get(2), [
        'Serial number "SN-100" already exists on asset "MacBook Pro".',
    ]);
    assert.deepEqual(errorMap.get(3), [
        'Asset tag "TAG-200" already exists on archived asset "Old Dock".',
    ]);
    assert.equal(errorMap.has(4), false);
});

test("import helper serializers keep internal row metadata out of UI and execute payloads", () => {
    const rowContexts = toImportRowContexts([
        { name: "Laptop", serialNumber: "SN-100", __rowNumber: 12 },
        { name: "Dock", assetTag: "TAG-200" },
    ]);

    const errorMap = new Map<number, string[]>([
        [12, ['Duplicate serial number "SN-100" also appears in row(s) 3.']],
    ]);

    const importableRows = filterRowsWithoutErrors(rowContexts, errorMap);
    const blockedRows = buildImportIssueRows(rowContexts, errorMap);

    assert.deepEqual(importableRows.map((row) => row.rowNumber), [3]);
    assert.deepEqual(blockedRows, [
        {
            rowNumber: 12,
            data: {
                name: "Laptop",
                serialNumber: "SN-100",
            },
            errors: ['Duplicate serial number "SN-100" also appears in row(s) 3.'],
        },
    ]);
    assert.deepEqual(serializeImportableRows(importableRows), [
        {
            rowNumber: 3,
            data: {
                name: "Dock",
                assetTag: "TAG-200",
            },
        },
    ]);
});
