"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlayCircleIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    completeMaintenanceJob,
    startMaintenanceJob,
} from "@/app/t/[slug]/maintenance/actions";

interface MaintenanceJobActionsProps {
    tenantSlug: string;
    assetId: string;
    job: {
        id: string;
        status: string;
    };
    canManage: boolean;
    compact?: boolean;
}

export function MaintenanceJobActions({
    tenantSlug,
    assetId,
    job,
    canManage,
    compact = false,
}: MaintenanceJobActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
    const [notes, setNotes] = useState("");
    const [cost, setCost] = useState("");

    if (!canManage || !["OPEN", "IN_PROGRESS"].includes(job.status)) {
        return null;
    }

    const handleStart = () => {
        startTransition(async () => {
            const result = await startMaintenanceJob(tenantSlug, assetId, {
                jobId: job.id,
            });

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Maintenance job started");
        });
    };

    const handleComplete = () => {
        startTransition(async () => {
            const result = await completeMaintenanceJob(tenantSlug, assetId, {
                jobId: job.id,
                notes,
                cost: cost === "" ? null : Number(cost),
            });

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            setIsCompleteDialogOpen(false);
            setNotes("");
            setCost("");
            toast.success("Maintenance job completed");
        });
    };

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {job.status === "OPEN" && (
                    <Button
                        type="button"
                        variant="outline"
                        size={compact ? "sm" : "default"}
                        onClick={handleStart}
                        disabled={isPending}
                    >
                        {isPending ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                            <PlayCircleIcon className="h-4 w-4" />
                        )}
                        Start
                    </Button>
                )}
                <Button
                    type="button"
                    size={compact ? "sm" : "default"}
                    onClick={() => setIsCompleteDialogOpen(true)}
                    disabled={isPending}
                >
                    <WrenchIcon className="h-4 w-4" />
                    Complete
                </Button>
            </div>

            <Dialog
                open={isCompleteDialogOpen}
                onOpenChange={setIsCompleteDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Complete Maintenance Job</DialogTitle>
                        <DialogDescription>
                            Record any optional notes or cost before marking this
                            maintenance task complete.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor={`maintenance-notes-${job.id}`}>
                                Notes
                            </Label>
                            <textarea
                                id={`maintenance-notes-${job.id}`}
                                rows={4}
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Optional completion notes"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor={`maintenance-cost-${job.id}`}>
                                Cost
                            </Label>
                            <Input
                                id={`maintenance-cost-${job.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={cost}
                                onChange={(event) => setCost(event.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCompleteDialogOpen(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleComplete}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                                <WrenchIcon className="h-4 w-4" />
                            )}
                            Complete Job
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
