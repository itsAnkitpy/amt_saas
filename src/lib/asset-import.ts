import { db } from "@/lib/db";

export interface ImportRowContext {
    rowNumber: number;
    data: Record<string, unknown>;
}

export interface ImportIssueRow {
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
}

type AssetImportLookupClient = Pick<typeof db, "asset">;

function normalizeIdentifier(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getSerializedImportRowData(
    row: Record<string, unknown>
): Record<string, string> {
    const serialized: Record<string, string> = {};

    for (const [key, value] of Object.entries(row)) {
        if (key === "__rowNumber") {
            continue;
        }

        if (typeof value === "string") {
            serialized[key] = value;
        }
    }

    return serialized;
}

export function toImportRowContexts(
    rows: Record<string, unknown>[],
    startingRowNumber = 2
): ImportRowContext[] {
    return rows.map((row, index) => {
        const rawRowNumber = row.__rowNumber;
        const rowNumber =
            typeof rawRowNumber === "number" && Number.isFinite(rawRowNumber)
                ? rawRowNumber
                : startingRowNumber + index;

        return {
            rowNumber,
            data: row,
        };
    });
}

export function findDuplicateIdentifierErrors(rows: ImportRowContext[]) {
    const serialToRows = new Map<string, number[]>();
    const assetTagToRows = new Map<string, number[]>();

    for (const row of rows) {
        const serialNumber = normalizeIdentifier(row.data.serialNumber);
        const assetTag = normalizeIdentifier(row.data.assetTag);

        if (serialNumber) {
            serialToRows.set(serialNumber, [
                ...(serialToRows.get(serialNumber) ?? []),
                row.rowNumber,
            ]);
        }

        if (assetTag) {
            assetTagToRows.set(assetTag, [
                ...(assetTagToRows.get(assetTag) ?? []),
                row.rowNumber,
            ]);
        }
    }

    const errorMap = new Map<number, string[]>();

    for (const row of rows) {
        const errors: string[] = [];
        const serialNumber = normalizeIdentifier(row.data.serialNumber);
        const assetTag = normalizeIdentifier(row.data.assetTag);

        if (serialNumber) {
            const matchingRows = serialToRows.get(serialNumber) ?? [];
            if (matchingRows.length > 1) {
                const otherRows = matchingRows.filter(
                    (rowNumber) => rowNumber !== row.rowNumber
                );
                errors.push(
                    `Duplicate serial number "${serialNumber}" also appears in row(s) ${otherRows.join(", ")}.`
                );
            }
        }

        if (assetTag) {
            const matchingRows = assetTagToRows.get(assetTag) ?? [];
            if (matchingRows.length > 1) {
                const otherRows = matchingRows.filter(
                    (rowNumber) => rowNumber !== row.rowNumber
                );
                errors.push(
                    `Duplicate asset tag "${assetTag}" also appears in row(s) ${otherRows.join(", ")}.`
                );
            }
        }

        if (errors.length > 0) {
            errorMap.set(row.rowNumber, errors);
        }
    }

    return errorMap;
}

export async function findExistingIdentifierErrors(
    client: AssetImportLookupClient,
    tenantId: string,
    rows: ImportRowContext[]
) {
    const serialNumbers = Array.from(
        new Set(
            rows
                .map((row) => normalizeIdentifier(row.data.serialNumber))
                .filter((value): value is string => Boolean(value))
        )
    );

    const assetTags = Array.from(
        new Set(
            rows
                .map((row) => normalizeIdentifier(row.data.assetTag))
                .filter((value): value is string => Boolean(value))
        )
    );

    if (serialNumbers.length === 0 && assetTags.length === 0) {
        return new Map<number, string[]>();
    }

    const orConditions: Array<Record<string, unknown>> = [];

    if (serialNumbers.length > 0) {
        orConditions.push({ serialNumber: { in: serialNumbers } });
    }

    if (assetTags.length > 0) {
        orConditions.push({ assetTag: { in: assetTags } });
    }

    const existingAssets = await client.asset.findMany({
        where: {
            tenantId,
            OR: orConditions,
        },
        select: {
            name: true,
            serialNumber: true,
            assetTag: true,
            archivedAt: true,
        },
    });

    const serialConflictMap = new Map(
        existingAssets
            .filter((asset) => asset.serialNumber)
            .map((asset) => [asset.serialNumber as string, asset])
    );

    const assetTagConflictMap = new Map(
        existingAssets
            .filter((asset) => asset.assetTag)
            .map((asset) => [asset.assetTag as string, asset])
    );

    const errorMap = new Map<number, string[]>();

    for (const row of rows) {
        const errors: string[] = [];
        const serialNumber = normalizeIdentifier(row.data.serialNumber);
        const assetTag = normalizeIdentifier(row.data.assetTag);

        if (serialNumber) {
            const serialConflict = serialConflictMap.get(serialNumber);
            if (serialConflict) {
                errors.push(
                    `Serial number "${serialNumber}" already exists on ${serialConflict.archivedAt ? "archived " : ""}asset "${serialConflict.name}".`
                );
            }
        }

        if (assetTag) {
            const assetTagConflict = assetTagConflictMap.get(assetTag);
            if (assetTagConflict) {
                errors.push(
                    `Asset tag "${assetTag}" already exists on ${assetTagConflict.archivedAt ? "archived " : ""}asset "${assetTagConflict.name}".`
                );
            }
        }

        if (errors.length > 0) {
            errorMap.set(row.rowNumber, errors);
        }
    }

    return errorMap;
}

export function filterRowsWithoutErrors(
    rows: ImportRowContext[],
    errorMap: Map<number, string[]>
) {
    return rows.filter((row) => !errorMap.has(row.rowNumber));
}

export function buildImportIssueRows(
    rows: ImportRowContext[],
    errorMap: Map<number, string[]>
) {
    return rows
        .filter((row) => errorMap.has(row.rowNumber))
        .map((row) => ({
            rowNumber: row.rowNumber,
            data: getSerializedImportRowData(row.data),
            errors: errorMap.get(row.rowNumber) ?? [],
        }));
}

export function serializeImportableRows(rows: ImportRowContext[]) {
    return rows.map((row) => ({
        rowNumber: row.rowNumber,
        data: getSerializedImportRowData(row.data),
    }));
}
