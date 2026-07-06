"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { inviteTeammateAction } from "./actions";

/**
 * Client door invite form. Imports ONLY the server action (never the invitation
 * service directly) to keep server-only code out of the client bundle. Shows the
 * action's error/success inline and refreshes the pending list on success.
 */
export function InviteTeammateForm({ slug }: { slug: string }) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        const result = await inviteTeammateAction(slug, formData);
        setIsSubmitting(false);

        if (result.error) {
            setError(result.error);
            return;
        }
        setSuccess(`Invitation sent to ${result.email}.`);
        formRef.current?.reset();
        router.refresh(); // re-render the server page so the new invite appears
    };

    return (
        <form ref={formRef} action={handleSubmit} className="space-y-4">
            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40">
                    {success}
                </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="teammate@company.com"
                        required
                    />
                </div>
                <div className="space-y-1 sm:w-40">
                    <Label htmlFor="role">Role</Label>
                    <Select name="role" defaultValue="USER">
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="USER">User</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                    Send invite
                </Button>
            </div>
        </form>
    );
}
