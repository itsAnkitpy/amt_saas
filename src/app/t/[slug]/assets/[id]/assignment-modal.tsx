"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UserPlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { assignAsset } from "../actions";

interface User {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
}

interface AssignmentModalProps {
    assetId: string;
    tenantSlug: string;
    users: User[];
}

export function AssignmentModal({
    assetId,
    tenantSlug,
    users,
}: AssignmentModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssign = async () => {
        if (!selectedUserId) return;

        setIsSubmitting(true);
        await assignAsset(tenantSlug, assetId, selectedUserId, notes || undefined);
        setIsOpen(false);
        setIsSubmitting(false);
    };

    return (
        <>
            <Button variant="default" size="sm" onClick={() => setIsOpen(true)}>
                <UserPlusIcon className="mr-2 h-4 w-4" />
                Assign
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Assign Asset</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-zinc-400 hover:text-zinc-600"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label>Select User *</Label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.firstName} {user.lastName} ({user.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Notes (optional)</Label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    rows={2}
                                    placeholder="Add notes about this assignment..."
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssign}
                                disabled={!selectedUserId || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    "Assign"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
