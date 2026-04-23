"use client";

import { useMemo, useState, useTransition } from "react";
import {
    CalendarClockIcon,
    Loader2Icon,
    Settings2Icon,
    ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    disableMaintenanceSchedule,
    upsertMaintenanceSchedule,
} from "@/app/t/[slug]/maintenance/actions";
import { MaintenanceJobActions } from "@/components/maintenance-job-actions";

type MaintenanceIntervalUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

interface MaintenanceSchedule {
    id: string;
    isActive: boolean;
    intervalValue: number;
    intervalUnit: MaintenanceIntervalUnit;
    instructions: string | null;
}

interface MaintenanceJob {
    id: string;
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    dueAt: string;
    startedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    notes: string | null;
    cost: string | null;
    completedByName: string | null;
}

interface AssetMaintenanceCardProps {
    tenantSlug: string;
    assetId: string;
    schedule: MaintenanceSchedule | null;
    jobs: MaintenanceJob[];
    canManageMaintenance: boolean;
    isArchived: boolean;
}

function formatInterval(value: number, unit: MaintenanceIntervalUnit) {
    const labels: Record<MaintenanceIntervalUnit, string> = {
        DAYS: "day",
        WEEKS: "week",
        MONTHS: "month",
        YEARS: "year",
    };

    return `Every ${value} ${labels[unit]}${value === 1 ? "" : "s"}`;
}

function formatDate(value: string | null) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleDateString();
}

export function AssetMaintenanceCard({
    tenantSlug,
    assetId,
    schedule,
    jobs,
    canManageMaintenance,
    isArchived,
}: AssetMaintenanceCardProps) {
    const [isPending, startTransition] = useTransition();
    const currentJob = useMemo(
        () =>
            jobs.find(
                (job) => job.status === "IN_PROGRESS" || job.status === "OPEN"
            ) ?? null,
        [jobs]
    );
    const historyJobs = useMemo(
        () =>
            jobs.filter(
                (job) =>
                    job.status === "COMPLETED" || job.status === "CANCELLED"
            ),
        [jobs]
    );
    const [intervalValue, setIntervalValue] = useState(
        schedule ? String(schedule.intervalValue) : ""
    );
    const [intervalUnit, setIntervalUnit] = useState<
        MaintenanceIntervalUnit | ""
    >(schedule?.intervalUnit ?? "");
    const [firstDueAt, setFirstDueAt] = useState(
        currentJob?.dueAt ? currentJob.dueAt.slice(0, 10) : ""
    );
    const [instructions, setInstructions] = useState(
        schedule?.instructions ?? ""
    );

    const handleSave = () => {
        startTransition(async () => {
            const result = await upsertMaintenanceSchedule(tenantSlug, assetId, {
                intervalValue,
                intervalUnit,
                firstDueAt,
                instructions,
            });

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success(
                schedule ? "Maintenance schedule updated" : "Maintenance scheduled"
            );
        });
    };

    const handleDisable = () => {
        startTransition(async () => {
            const result = await disableMaintenanceSchedule(tenantSlug, assetId);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Maintenance schedule disabled");
        });
    };

    return (
        <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                        <CalendarClockIcon className="h-5 w-5" />
                        Maintenance
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                        Track one recurring maintenance schedule and the rolling work
                        queue for this asset.
                    </p>
                </div>

                {schedule ? (
                    <Badge variant={schedule.isActive ? "default" : "outline"}>
                        {schedule.isActive ? "Active schedule" : "Disabled schedule"}
                    </Badge>
                ) : (
                    <Badge variant="outline">Not configured</Badge>
                )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-dashed p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Interval
                    </p>
                    <p className="mt-2 font-medium">
                        {schedule
                            ? formatInterval(
                                  schedule.intervalValue,
                                  schedule.intervalUnit
                              )
                            : "No maintenance schedule"}
                    </p>
                </div>

                <div className="rounded-lg border border-dashed p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Next Due
                    </p>
                    <p className="mt-2 font-medium">
                        {currentJob ? formatDate(currentJob.dueAt) : "No open job"}
                    </p>
                </div>

                <div className="rounded-lg border border-dashed p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Current Job
                    </p>
                    <p className="mt-2 font-medium">
                        {currentJob
                            ? currentJob.status === "IN_PROGRESS"
                                ? "In progress"
                                : "Open"
                            : "No active work"}
                    </p>
                </div>
            </div>

            {schedule?.instructions && (
                <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    {schedule.instructions}
                </div>
            )}

            {currentJob && (
                <div className="mt-4 rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-medium">Current maintenance job</p>
                            <p className="mt-1 text-sm text-zinc-500">
                                Due {formatDate(currentJob.dueAt)}
                                {currentJob.startedAt &&
                                    ` • Started ${formatDate(currentJob.startedAt)}`}
                            </p>
                        </div>
                        <MaintenanceJobActions
                            tenantSlug={tenantSlug}
                            assetId={assetId}
                            job={currentJob}
                            canManage={canManageMaintenance && !isArchived}
                        />
                    </div>
                </div>
            )}

            {canManageMaintenance && !isArchived && (
                <div className="mt-6 rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                        <Settings2Icon className="h-4 w-4 text-zinc-500" />
                        <p className="font-medium">
                            {schedule ? "Update schedule" : "Set up maintenance"}
                        </p>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="maintenance-interval-value">
                                Interval
                            </Label>
                            <Input
                                id="maintenance-interval-value"
                                type="number"
                                min="1"
                                value={intervalValue}
                                onChange={(event) =>
                                    setIntervalValue(event.target.value)
                                }
                                placeholder="e.g., 6"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="maintenance-interval-unit">
                                Unit
                            </Label>
                            <select
                                id="maintenance-interval-unit"
                                value={intervalUnit}
                                onChange={(event) =>
                                    setIntervalUnit(
                                        event.target
                                            .value as MaintenanceIntervalUnit | ""
                                    )
                                }
                                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                            >
                                <option value="">Select interval unit</option>
                                <option value="DAYS">Days</option>
                                <option value="WEEKS">Weeks</option>
                                <option value="MONTHS">Months</option>
                                <option value="YEARS">Years</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="maintenance-first-due-at">
                                First or next due date
                            </Label>
                            <Input
                                id="maintenance-first-due-at"
                                type="date"
                                value={firstDueAt}
                                onChange={(event) =>
                                    setFirstDueAt(event.target.value)
                                }
                            />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="maintenance-instructions">
                                Instructions
                            </Label>
                            <textarea
                                id="maintenance-instructions"
                                rows={3}
                                value={instructions}
                                onChange={(event) =>
                                    setInstructions(event.target.value)
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Optional instructions for this recurring work"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                                <CalendarClockIcon className="h-4 w-4" />
                            )}
                            {schedule ? "Save schedule" : "Create schedule"}
                        </Button>

                        {schedule?.isActive && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDisable}
                                disabled={isPending}
                            >
                                Disable schedule
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {isArchived && (
                <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <div className="flex items-start gap-2">
                        <ShieldAlertIcon className="mt-0.5 h-4 w-4" />
                        <p>
                            Maintenance is read-only for archived assets. Any open
                            maintenance work is cancelled when the asset is archived.
                        </p>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <p className="font-medium">Recent maintenance history</p>
                {historyJobs.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">
                        No completed or cancelled maintenance jobs yet.
                    </p>
                ) : (
                    <div className="mt-3 space-y-3">
                        {historyJobs.map((job) => (
                            <div
                                key={job.id}
                                className="rounded-lg border border-dashed p-4"
                            >
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="font-medium">
                                            {job.status === "COMPLETED"
                                                ? "Completed"
                                                : "Cancelled"}
                                        </p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Due {formatDate(job.dueAt)}
                                            {job.completedAt &&
                                                ` • Completed ${formatDate(job.completedAt)}`}
                                            {job.cancelledAt &&
                                                ` • Cancelled ${formatDate(job.cancelledAt)}`}
                                        </p>
                                    </div>
                                    {job.cost && (
                                        <Badge variant="outline">
                                            ₹{Number(job.cost).toLocaleString()}
                                        </Badge>
                                    )}
                                </div>
                                {(job.notes || job.completedByName) && (
                                    <div className="mt-2 text-sm text-zinc-600">
                                        {job.completedByName && (
                                            <p>Completed by {job.completedByName}</p>
                                        )}
                                        {job.notes && (
                                            <p className="mt-1 whitespace-pre-wrap">
                                                {job.notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
