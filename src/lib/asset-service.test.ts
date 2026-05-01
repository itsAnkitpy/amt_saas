import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type { FieldDefinition } from "./validations";

const require = createRequire(import.meta.url);
const {
    archiveAssetWithContext,
    assignAssetWithContext,
    restoreAssetWithContext,
    unassignAssetWithContext,
    validateAndNormalizeCustomFields,
} = require("./asset-service.ts") as typeof import("./asset-service");
const { ApiError } = require("./api-error.ts") as typeof import("./api-error");

type ArchiveAssetClient = Parameters<typeof archiveAssetWithContext>[1];
type AssignAssetParams = Parameters<typeof assignAssetWithContext>[0];
type AssetMutationClient = Parameters<typeof assignAssetWithContext>[1];
type ActivityLogger = Parameters<typeof assignAssetWithContext>[2];
type MaintenanceDeactivator = NonNullable<
    Parameters<typeof archiveAssetWithContext>[3]
>;
type RestoreAssetClient = Parameters<typeof restoreAssetWithContext>[1];

type TestAssetState = {
    id: string;
    tenantId: string;
    status: string;
    assignedToId: string | null;
    archivedAt: Date | null;
};

type TestAssigneeState = {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string | null;
    isActive: boolean;
};

type TestAssignmentRecord = {
    id: string;
    assetId: string;
    notes: string | null;
    returnedAt: Date | null;
    user: {
        firstName: string;
        lastName: string | null;
    };
};

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

const tenantId = "tenant_123";
const managerUser: AssignAssetParams["user"] = {
    id: "user_manager",
    firstName: "Alex",
    lastName: "Morgan",
};

function createActivityLoggerSpy() {
    const calls: Parameters<NonNullable<ActivityLogger>>[0][] = [];

    const logger = (async (params: Parameters<NonNullable<ActivityLogger>>[0]) => {
        calls.push(params);
        return null;
    }) as unknown as NonNullable<ActivityLogger>;

    return { calls, logger };
}

function createMaintenanceDeactivatorSpy() {
    const calls: Parameters<MaintenanceDeactivator>[0][] = [];

    const deactivator = (async (
        params: Parameters<MaintenanceDeactivator>[0]
    ) => {
        calls.push(params);
        return {
            hadSchedule: true,
            activeScheduleCount: 1,
            cancelledJobCount: 1,
        };
    }) as unknown as MaintenanceDeactivator;

    return { calls, deactivator };
}

function createAssetMutationClient(options: {
    asset: TestAssetState | null;
    assignee?: TestAssigneeState | null;
    currentAssignment?: TestAssignmentRecord | null;
}) {
    const state = {
        asset: options.asset ? { ...options.asset } : null,
        assignee: options.assignee ? { ...options.assignee } : null,
        currentAssignment: options.currentAssignment
            ? {
                ...options.currentAssignment,
                user: { ...options.currentAssignment.user },
            }
            : null,
    };

    const calls = {
        assignmentCreates: [] as Array<{
            assetId: string;
            userId: string;
            notes: string | null;
        }>,
        assignmentUpdates: [] as Array<{
            where: { id: string };
            data: {
                returnedAt: Date;
                notes: string | null;
            };
        }>,
        assetUpdates: [] as Array<{
            assignedToId?: string | null;
            status: string;
            archivedAt?: Date | null;
        }>,
    };

    const client = {
        asset: {
            findFirst: async (args: {
                where: { id: string; tenantId: string };
            }) => {
                if (
                    !state.asset ||
                    state.asset.id !== args.where.id ||
                    state.asset.tenantId !== args.where.tenantId
                ) {
                    return null;
                }

                return {
                    id: state.asset.id,
                    status: state.asset.status,
                    assignedToId: state.asset.assignedToId,
                    archivedAt: state.asset.archivedAt,
                };
            },
            update: async (args: {
                where: { id: string };
                data: {
                    assignedToId?: string | null;
                    status: string;
                    archivedAt?: Date | null;
                };
            }) => {
                assert.equal(args.where.id, state.asset?.id);

                if (!state.asset) {
                    throw new Error("Asset state was unexpectedly missing");
                }

                state.asset = {
                    ...state.asset,
                    ...args.data,
                };
                calls.assetUpdates.push(args.data);

                return state.asset;
            },
        },
        user: {
            findFirst: async (args: {
                where: { id: string; tenantId: string; isActive: boolean };
            }) => {
                if (
                    !state.assignee ||
                    state.assignee.id !== args.where.id ||
                    state.assignee.tenantId !== args.where.tenantId ||
                    state.assignee.isActive !== args.where.isActive
                ) {
                    return null;
                }

                return {
                    id: state.assignee.id,
                    firstName: state.assignee.firstName,
                    lastName: state.assignee.lastName,
                };
            },
        },
        assetAssignment: {
            create: async (args: {
                data: { assetId: string; userId: string; notes: string | null };
            }) => {
                calls.assignmentCreates.push(args.data);

                return {
                    id: "assignment_new",
                    ...args.data,
                };
            },
            findFirst: async () => {
                if (!state.currentAssignment) {
                    return null;
                }

                return {
                    ...state.currentAssignment,
                    user: { ...state.currentAssignment.user },
                };
            },
            update: async (args: {
                where: { id: string };
                data: {
                    returnedAt: Date;
                    notes: string | null;
                };
            }) => {
                assert.equal(args.where.id, state.currentAssignment?.id);

                if (!state.currentAssignment) {
                    throw new Error("Assignment state was unexpectedly missing");
                }

                state.currentAssignment = {
                    ...state.currentAssignment,
                    returnedAt: args.data.returnedAt,
                    notes: args.data.notes,
                };
                calls.assignmentUpdates.push(args);

                return state.currentAssignment;
            },
        },
        assetActivity: {
            create: async (args: {
                data: Record<string, unknown>;
            }) => ({
                id: "activity_123",
                createdAt: new Date(),
                ...args.data,
            }),
            createMany: async (args: { data: Array<Record<string, unknown>> }) => ({
                count: args.data.length,
            }),
        },
        assetMaintenanceSchedule: {
            findMany: async () => [],
            updateMany: async () => ({ count: 0 }),
        },
        maintenanceJob: {
            findMany: async () => [],
            updateMany: async () => ({ count: 0 }),
        },
    };

    return {
        client: client as unknown as AssetMutationClient,
        calls,
        state,
    };
}

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

test("assignAssetWithContext creates the assignment record, updates the asset, and logs activity", async () => {
    const { client, calls, state } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "AVAILABLE",
            assignedToId: null,
            archivedAt: null,
        },
        assignee: {
            id: "user_assignee",
            tenantId,
            firstName: "Jamie",
            lastName: "Lee",
            isActive: true,
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();

    const asset = await assignAssetWithContext(
        {
            assetId: "asset_123",
            assigneeId: "user_assignee",
            notes: "  Loaner for onsite  ",
            tenantId,
            user: managerUser,
        },
        client,
        logger
    );

    assert.equal(asset.id, "asset_123");
    assert.deepEqual(calls.assignmentCreates, [
        {
            assetId: "asset_123",
            userId: "user_assignee",
            notes: "Loaner for onsite",
        },
    ]);
    assert.deepEqual(calls.assetUpdates, [
        {
            assignedToId: "user_assignee",
            status: "ASSIGNED",
        },
    ]);
    assert.equal(state.asset?.assignedToId, "user_assignee");
    assert.equal(state.asset?.status, "ASSIGNED");
    assert.deepEqual(activityCalls, [
        {
            action: "ASSIGNED",
            assetId: "asset_123",
            userId: "user_manager",
            userName: "Alex Morgan",
            tenantId,
            details: {
                assignedTo: "Jamie Lee",
            },
        },
    ]);
});

test("assignAssetWithContext rejects assets that are already assigned", async () => {
    const { client, calls } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "ASSIGNED",
            assignedToId: "user_assignee",
            archivedAt: null,
        },
        assignee: {
            id: "user_assignee",
            tenantId,
            firstName: "Jamie",
            lastName: "Lee",
            isActive: true,
        },
    });

    await assert.rejects(
        () =>
            assignAssetWithContext(
                {
                    assetId: "asset_123",
                    assigneeId: "user_assignee",
                    tenantId,
                    user: managerUser,
                },
                client
            ),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /Asset is already assigned/);
            return true;
        }
    );

    assert.equal(calls.assignmentCreates.length, 0);
    assert.equal(calls.assetUpdates.length, 0);
});

test("unassignAssetWithContext closes the active assignment, updates the asset, and logs activity", async () => {
    const { client, calls, state } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "ASSIGNED",
            assignedToId: "user_assignee",
            archivedAt: null,
        },
        currentAssignment: {
            id: "assignment_456",
            assetId: "asset_123",
            notes: "Initial handoff",
            returnedAt: null,
            user: {
                firstName: "Jamie",
                lastName: "Lee",
            },
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();

    const asset = await unassignAssetWithContext(
        {
            assetId: "asset_123",
            notes: "  Returned to storage  ",
            tenantId,
            user: managerUser,
        },
        client,
        logger
    );

    assert.equal(asset.id, "asset_123");
    assert.equal(calls.assignmentUpdates.length, 1);
    assert.equal(calls.assignmentUpdates[0]?.where.id, "assignment_456");
    assert.ok(calls.assignmentUpdates[0]?.data.returnedAt instanceof Date);
    assert.equal(calls.assignmentUpdates[0]?.data.notes, "Returned to storage");
    assert.deepEqual(calls.assetUpdates, [
        {
            assignedToId: null,
            status: "AVAILABLE",
        },
    ]);
    assert.equal(state.asset?.assignedToId, null);
    assert.equal(state.asset?.status, "AVAILABLE");
    assert.ok(state.currentAssignment?.returnedAt instanceof Date);
    assert.equal(state.currentAssignment?.notes, "Returned to storage");
    assert.deepEqual(activityCalls, [
        {
            action: "UNASSIGNED",
            assetId: "asset_123",
            userId: "user_manager",
            userName: "Alex Morgan",
            tenantId,
            details: {
                previousAssignee: "Jamie Lee",
            },
        },
    ]);
});

test("unassignAssetWithContext preserves the existing assignment notes when no replacement note is provided", async () => {
    const { client, calls, state } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "ASSIGNED",
            assignedToId: "user_assignee",
            archivedAt: null,
        },
        currentAssignment: {
            id: "assignment_456",
            assetId: "asset_123",
            notes: "Initial handoff",
            returnedAt: null,
            user: {
                firstName: "Jamie",
                lastName: "Lee",
            },
        },
    });

    await unassignAssetWithContext(
        {
            assetId: "asset_123",
            tenantId,
            user: managerUser,
        },
        client
    );

    assert.equal(calls.assignmentUpdates[0]?.data.notes, "Initial handoff");
    assert.equal(state.currentAssignment?.notes, "Initial handoff");
});

test("unassignAssetWithContext rejects assets without an active assignment record", async () => {
    const { client, calls } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "ASSIGNED",
            assignedToId: "user_assignee",
            archivedAt: null,
        },
        currentAssignment: null,
    });

    await assert.rejects(
        () =>
            unassignAssetWithContext(
                {
                    assetId: "asset_123",
                    tenantId,
                    user: managerUser,
                },
                client
            ),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /Active assignment record not found/);
            return true;
        }
    );

    assert.equal(calls.assignmentUpdates.length, 0);
    assert.equal(calls.assetUpdates.length, 0);
});

test("archiveAssetWithContext retires the asset, disables maintenance, and logs the archive event", async () => {
    const { client, calls, state } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "AVAILABLE",
            assignedToId: null,
            archivedAt: null,
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();
    const { calls: maintenanceCalls, deactivator } =
        createMaintenanceDeactivatorSpy();

    const asset = await archiveAssetWithContext(
        {
            assetId: "asset_123",
            tenantId,
            user: managerUser,
        },
        client as unknown as ArchiveAssetClient,
        logger,
        deactivator
    );

    assert.equal(asset.id, "asset_123");
    assert.equal(calls.assetUpdates.length, 1);
    assert.equal(calls.assetUpdates[0]?.status, "RETIRED");
    assert.ok(calls.assetUpdates[0]?.archivedAt instanceof Date);
    assert.equal(state.asset?.status, "RETIRED");
    assert.ok(state.asset?.archivedAt instanceof Date);
    assert.deepEqual(maintenanceCalls, [
        {
            assetIds: ["asset_123"],
            reason: "asset_archived",
            userId: "user_manager",
            userName: "Alex Morgan",
            tenantId,
            disabledAt: calls.assetUpdates[0]?.archivedAt,
        },
    ]);
    assert.deepEqual(activityCalls, [
        {
            action: "DELETED",
            assetId: "asset_123",
            userId: "user_manager",
            userName: "Alex Morgan",
            tenantId,
            details: {
                reason: "soft_delete",
                archivedAt: calls.assetUpdates[0]?.archivedAt?.toISOString(),
            },
        },
    ]);
});

test("archiveAssetWithContext rejects assigned assets before any archive side effects run", async () => {
    const { client, calls } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "ASSIGNED",
            assignedToId: "user_assignee",
            archivedAt: null,
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();
    const { calls: maintenanceCalls, deactivator } =
        createMaintenanceDeactivatorSpy();

    await assert.rejects(
        () =>
            archiveAssetWithContext(
                {
                    assetId: "asset_123",
                    tenantId,
                    user: managerUser,
                },
                client as unknown as ArchiveAssetClient,
                logger,
                deactivator
            ),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /Unassign the asset before deleting it/);
            return true;
        }
    );

    assert.equal(calls.assetUpdates.length, 0);
    assert.equal(maintenanceCalls.length, 0);
    assert.equal(activityCalls.length, 0);
});

test("restoreAssetWithContext makes an archived asset available again and logs the restore", async () => {
    const archivedAt = new Date("2026-04-20T09:00:00.000Z");
    const { client, calls, state } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "RETIRED",
            assignedToId: null,
            archivedAt,
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();

    const asset = await restoreAssetWithContext(
        {
            assetId: "asset_123",
            tenantId,
            user: managerUser,
        },
        client as unknown as RestoreAssetClient,
        logger
    );

    assert.equal(asset.id, "asset_123");
    assert.equal(asset.status, "RETIRED");
    assert.deepEqual(calls.assetUpdates, [
        {
            status: "AVAILABLE",
            archivedAt: null,
        },
    ]);
    assert.equal(state.asset?.status, "AVAILABLE");
    assert.equal(state.asset?.archivedAt, null);
    assert.equal(activityCalls[0]?.action, "RESTORED");
    assert.equal(activityCalls[0]?.assetId, "asset_123");
    assert.equal(activityCalls[0]?.userName, "Alex Morgan");

    const details = activityCalls[0]?.details as
        | { previousStatus: string; restoredAt: string }
        | undefined;
    assert.equal(details?.previousStatus, "RETIRED");
    assert.ok(details?.restoredAt);
    assert.ok(Number.isFinite(Date.parse(details?.restoredAt ?? "")));
});

test("restoreAssetWithContext rejects assets that are not archived", async () => {
    const { client, calls } = createAssetMutationClient({
        asset: {
            id: "asset_123",
            tenantId,
            status: "AVAILABLE",
            assignedToId: null,
            archivedAt: null,
        },
    });
    const { calls: activityCalls, logger } = createActivityLoggerSpy();

    await assert.rejects(
        () =>
            restoreAssetWithContext(
                {
                    assetId: "asset_123",
                    tenantId,
                    user: managerUser,
                },
                client as unknown as RestoreAssetClient,
                logger
            ),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /Asset is not archived/);
            return true;
        }
    );

    assert.equal(calls.assetUpdates.length, 0);
    assert.equal(activityCalls.length, 0);
});
