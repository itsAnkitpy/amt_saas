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

const ACTION_LABELS: Record<string, { sentence: string; title: string }> = {
    ASSIGNED: { sentence: "assigned", title: "Assigned" },
    CREATED: { sentence: "created", title: "Created" },
    DELETED: { sentence: "archived", title: "Archived" },
    IMAGE_ADDED: { sentence: "image added", title: "Image added" },
    IMAGE_REMOVED: { sentence: "image removed", title: "Image removed" },
    MAINTENANCE_CANCELLED: {
        sentence: "maintenance cancelled",
        title: "Maintenance cancelled",
    },
    MAINTENANCE_COMPLETED: {
        sentence: "maintenance completed",
        title: "Maintenance completed",
    },
    MAINTENANCE_DISABLED: {
        sentence: "maintenance disabled",
        title: "Maintenance disabled",
    },
    MAINTENANCE_SCHEDULED: {
        sentence: "maintenance scheduled",
        title: "Maintenance scheduled",
    },
    MAINTENANCE_STARTED: {
        sentence: "maintenance started",
        title: "Maintenance started",
    },
    MAINTENANCE_UPDATED: {
        sentence: "maintenance updated",
        title: "Maintenance updated",
    },
    RESTORED: { sentence: "restored", title: "Restored" },
    STATUS_CHANGED: { sentence: "status changed", title: "Status changed" },
    UNASSIGNED: { sentence: "unassigned", title: "Unassigned" },
    UPDATED: { sentence: "updated", title: "Updated" },
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

export function getActivityActionLabel(
    action: string,
    variant: "sentence" | "title" = "sentence"
) {
    const label = ACTION_LABELS[action]?.[variant];
    if (label) return label;

    const fallback = action.toLowerCase().replaceAll("_", " ");
    return variant === "title"
        ? `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}`
        : fallback;
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
