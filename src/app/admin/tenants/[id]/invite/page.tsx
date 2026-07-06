import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createUserForTenant, inviteToTenantByEmail } from "./actions";
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
import { ArrowLeftIcon } from "lucide-react";

interface InviteUserPageProps {
    params: Promise<{ id: string }>;
}

/**
 * Superadmin door for adding a teammate to a tenant. Two paths on one page:
 * the primary email invitation (shared engine, teammate sets their own
 * password) and a manual "add without email" fallback (direct password create).
 */
export default async function InviteUserPage({ params }: InviteUserPageProps) {
    const { id } = await params;

    const tenant = await db.tenant.findUnique({
        where: { id },
    });

    if (!tenant) {
        notFound();
    }

    // Bind both actions with the tenant id.
    const inviteByEmail = inviteToTenantByEmail.bind(null, tenant.id);
    const createUser = createUserForTenant.bind(null, tenant.id);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/admin/tenants/${tenant.id}`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold">Add Teammate</h2>
                    <p className="text-zinc-600">Add a new user to {tenant.name}</p>
                </div>
            </div>

            {/* Primary: email invitation via the shared engine */}
            <div className="mt-6 max-w-lg rounded-lg border bg-white p-6 dark:bg-zinc-950">
                <h3 className="text-lg font-semibold">Send email invitation</h3>
                <p className="mt-1 text-sm text-zinc-600">
                    The teammate gets an email and sets their own password. Uses the same
                    invite engine as the in-workspace flow.
                </p>
                <form action={inviteByEmail} className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email *</Label>
                        <Input
                            id="invite-email"
                            name="email"
                            type="email"
                            placeholder="user@example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select name="role" defaultValue="USER">
                            <SelectTrigger id="invite-role">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                                <SelectItem value="USER">User</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit">Send invitation</Button>
                </form>
            </div>

            {/* Fallback: manual add without email (direct password create) */}
            <div className="mt-6 max-w-lg rounded-lg border bg-zinc-50 p-6 dark:bg-zinc-900">
                <h3 className="text-lg font-semibold">Add without email (manual)</h3>
                <p className="mt-1 text-sm text-zinc-600">
                    Fallback for when the client can&apos;t receive email or for internal
                    testing. Creates the account directly with a password.
                </p>
                <form action={createUser} className="mt-4 space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="user@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input id="firstName" name="firstName" placeholder="John" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" name="lastName" placeholder="Doe" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Minimum 8 characters"
                            minLength={8}
                            required
                        />
                        <p className="text-sm text-zinc-500">
                            User can change this after logging in
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" defaultValue="USER">
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                                <SelectItem value="USER">User</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button type="submit">Create User</Button>
                        <Link href={`/admin/tenants/${tenant.id}`}>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
