const STATUS_LABELS: Record<string, string> = {
    AVAILABLE: "Available",
    ASSIGNED: "Assigned",
    MAINTENANCE: "Maintenance",
    RETIRED: "Retired",
};

const FIELD_LABELS: Record<string, string> = {
    assetTag: "asset tag",
    category: "category",
    condition: "condition",
    customFields: "custom fields",
    location: "location",
    name: "name",
    notes: "notes",
    purchaseDate: "purchase date",
    purchasePrice: "purchase price",
    serialNumber: "serial number",
    status: "status",
    warrantyEnd: "warranty end",
};

function asString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;
}

function asStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function formatList(items: string[]) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;

    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatStatus(value: unknown) {
    const status = asString(value);
    return status ? STATUS_LABELS[status] ?? status : null;
}

function formatChangedFields(value: unknown) {
    return formatList(
        asStringArray(value).map((field) => FIELD_LABELS[field] ?? field)
    );
}

export function formatActivityDetails(
    action: string,
    details: Record<string, unknown> | null
) {
    if (!details) return "";

    switch (action) {
        case "ASSIGNED":
            return asString(details.assignedTo)
                ? `to ${asString(details.assignedTo)}`
                : "";
        case "UNASSIGNED":
            return asString(details.previousAssignee)
                ? `from ${asString(details.previousAssignee)}`
                : "";
        case "STATUS_CHANGED": {
            const from = formatStatus(details.from);
            const to = formatStatus(details.to);
            const statusText = from && to ? `from ${from} to ${to}` : to ? `to ${to}` : "";
            const otherFields = formatChangedFields(details.fields);

            if (statusText && otherFields) {
                return `${statusText}; also updated ${otherFields}`;
            }

            return statusText || (otherFields ? `updated ${otherFields}` : "");
        }
        case "UPDATED":
            return formatChangedFields(details.fields);
        case "IMAGE_ADDED":
        case "IMAGE_REMOVED":
            return asString(details.fileName) ?? "";
        case "CREATED":
            return asString(details.category) ? `in ${asString(details.category)}` : "";
        case "MAINTENANCE_SCHEDULED":
        case "MAINTENANCE_UPDATED":
            return asString(details.intervalLabel)
                ? `(${asString(details.intervalLabel)}${
                    asString(details.dueAt)
                        ? `, next due ${new Date(asString(details.dueAt) as string).toLocaleDateString()}`
                        : ""
                })`
                : "";
        case "MAINTENANCE_DISABLED":
        case "MAINTENANCE_CANCELLED":
            return asString(details.reason) ? `(${asString(details.reason)})` : "";
        case "MAINTENANCE_STARTED":
            return asString(details.dueAt)
                ? `(due ${new Date(asString(details.dueAt) as string).toLocaleDateString()})`
                : "";
        case "MAINTENANCE_COMPLETED":
            return asString(details.nextDueAt)
                ? `(next due ${new Date(asString(details.nextDueAt) as string).toLocaleDateString()})`
                : "";
        default:
            return "";
    }
}
