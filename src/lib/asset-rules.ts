import {
    CreateAssetSchema,
    type CreateAsset,
    type FieldDefinition,
} from "@/lib/validations";

export const ASSET_DIRECT_STATUSES = [
    "AVAILABLE",
    "MAINTENANCE",
    "RETIRED",
] as const;

export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;

export type AssetDirectStatus = (typeof ASSET_DIRECT_STATUSES)[number];
type AssetConditionValue = (typeof ASSET_CONDITIONS)[number];

interface ImportRowForCreateParams {
    row: Record<string, unknown>;
    categoryId: string;
    fieldSchema: FieldDefinition[];
}

function getTextValue(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return null;
}

function isEmptyCustomFieldValue(value: unknown) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0)
    );
}

function stableSerialize(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
        .join(",")}}`;
}

function normalizeCustomFieldValue(field: FieldDefinition, rawValue: unknown) {
    switch (field.type) {
        case "text":
        case "textarea": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be text`);
            }

            return rawValue.trim();
        }

        case "number": {
            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                return rawValue;
            }

            if (typeof rawValue === "string") {
                const trimmed = rawValue.trim();
                const parsed = Number(trimmed);

                if (trimmed.length > 0 && Number.isFinite(parsed)) {
                    return parsed;
                }
            }

            throw new Error(`${field.label} must be a number`);
        }

        case "select": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be text`);
            }

            const selected = rawValue.trim();
            if (field.options?.length && !field.options.includes(selected)) {
                throw new Error(
                    `${field.label} must be one of: ${field.options.join(", ")}`
                );
            }

            return selected;
        }

        case "date": {
            if (typeof rawValue !== "string") {
                throw new Error(`${field.label} must be a valid date`);
            }

            const trimmed = rawValue.trim();
            if (Number.isNaN(Date.parse(trimmed))) {
                throw new Error(`${field.label} must be a valid date`);
            }

            return trimmed;
        }

        case "boolean": {
            if (typeof rawValue === "boolean") {
                return rawValue;
            }

            if (typeof rawValue === "string") {
                const normalized = rawValue.trim().toLowerCase();
                if (normalized === "true") return true;
                if (normalized === "false") return false;
            }

            throw new Error(`${field.label} must be true or false`);
        }
    }
}

export function haveCustomFieldsChanged(
    previousFields: unknown,
    nextFields: unknown
) {
    return stableSerialize(previousFields ?? {}) !== stableSerialize(nextFields ?? {});
}

export function validateAndNormalizeCustomFields(
    customFields: Record<string, unknown> | null | undefined,
    fieldSchema: FieldDefinition[]
) {
    if (!customFields) {
        customFields = {};
    }

    if (typeof customFields !== "object" || Array.isArray(customFields)) {
        throw new Error("Invalid custom fields format");
    }

    const normalizedFields: Record<string, unknown> = {};

    for (const field of fieldSchema) {
        const rawValue = customFields[field.key];

        if (isEmptyCustomFieldValue(rawValue)) {
            if (field.required) {
                throw new Error(`${field.label} is required`);
            }

            continue;
        }

        normalizedFields[field.key] = normalizeCustomFieldValue(field, rawValue);
    }

    return normalizedFields;
}

export function normalizeAssetCreateStatus(
    rawStatus: unknown,
    options: { assignedMessage?: string } = {}
): AssetDirectStatus {
    const rawText = getTextValue(rawStatus);
    const normalized = (rawText ?? "AVAILABLE").toUpperCase();

    if (normalized === "ASSIGNED") {
        throw new Error(
            options.assignedMessage ?? "Use the assign action after creating an asset"
        );
    }

    if (!ASSET_DIRECT_STATUSES.includes(normalized as AssetDirectStatus)) {
        throw new Error(
            `Invalid status: ${rawText ?? ""}. Must be one of: ${ASSET_DIRECT_STATUSES.join(", ")}`
        );
    }

    return normalized as AssetDirectStatus;
}

export function assertAssetCreateStatusAllowed(rawStatus: unknown) {
    normalizeAssetCreateStatus(rawStatus);
}

export function normalizeAssetCondition(rawCondition: unknown): AssetConditionValue {
    const rawText = getTextValue(rawCondition);
    const normalized = (rawText ?? "GOOD").toUpperCase();

    if (!ASSET_CONDITIONS.includes(normalized as AssetConditionValue)) {
        throw new Error(
            `Invalid condition: ${rawText ?? ""}. Must be one of: ${ASSET_CONDITIONS.join(", ")}`
        );
    }

    return normalized as AssetConditionValue;
}

export function extractCustomFieldsByLabel(
    row: Record<string, unknown>,
    fieldSchema: FieldDefinition[]
) {
    const customFields: Record<string, unknown> = {};

    for (const field of fieldSchema) {
        const value = row[field.label];

        if (!isEmptyCustomFieldValue(value)) {
            customFields[field.key] = value;
        }
    }

    return customFields;
}

function collectImportRowErrors(params: ImportRowForCreateParams) {
    const { row, categoryId, fieldSchema } = params;
    const errors: string[] = [];
    let status: AssetDirectStatus = "AVAILABLE";
    let condition: AssetConditionValue = "GOOD";
    let customFields: Record<string, unknown> = {};

    try {
        status = normalizeAssetCreateStatus(row.status, {
            assignedMessage:
                "Bulk import cannot create assigned assets. Import them as AVAILABLE and use assign afterward.",
        });
    } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid status");
    }

    try {
        condition = normalizeAssetCondition(row.condition);
    } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid condition");
    }

    try {
        customFields = validateAndNormalizeCustomFields(
            extractCustomFieldsByLabel(row, fieldSchema),
            fieldSchema
        );
    } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid custom fields");
    }

    const candidate = {
        name: getTextValue(row.name) ?? "",
        categoryId,
        serialNumber: getTextValue(row.serialNumber),
        assetTag: getTextValue(row.assetTag),
        status,
        condition,
        location: getTextValue(row.location),
        purchasePrice: getTextValue(row.purchasePrice),
        purchaseDate: getTextValue(row.purchaseDate),
        warrantyEnd: getTextValue(row.warrantyEnd),
        notes: getTextValue(row.notes),
        customFields,
    };

    const parsed = CreateAssetSchema.safeParse(candidate);
    if (!parsed.success) {
        errors.push(...parsed.error.issues.map((issue) => issue.message));
    }

    return {
        errors,
        data: errors.length === 0 && parsed.success ? parsed.data : null,
    };
}

export function validateAssetImportRowForCreate(params: ImportRowForCreateParams) {
    const { errors } = collectImportRowErrors(params);

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function normalizeAssetImportRowForCreate(
    params: ImportRowForCreateParams
): CreateAsset {
    const { errors, data } = collectImportRowErrors(params);

    if (errors.length > 0 || !data) {
        throw new Error(errors.join("; "));
    }

    return data;
}
