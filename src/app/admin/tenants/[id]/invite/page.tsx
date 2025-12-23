import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createUserForTenant } from "./actions";
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
 * Create User Page (Direct creation for local development)
 */
export default async function InviteUserPage({ params }: InviteUserPageProps) {
    const { id } = await params;

    const tenant = await db.tenant.findUnique({
        where: { id },
    });

    if (!tenant) {
        notFound();
    }

    // Bind the action with tenant ID
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
                    <h2 className="text-2xl font-bold">Create User</h2>
                    <p className="text-zinc-600">
                        Add a new user to {tenant.name}
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 max-w-lg rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Development Mode:</strong> This creates the user directly with a password.
                    In production, use email invites instead.
                </p>
            </div>

            {/* Form */}
            <div className="mt-6 max-w-lg">
                <form action={createUser} className="space-y-6">
                    {/* Email */}
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

                    {/* First Name */}
                    <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                            id="firstName"
                            name="firstName"
                            placeholder="John"
                            required
                        />
                    </div>

                    {/* Last Name */}
                    <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                            id="lastName"
                            name="lastName"
                            placeholder="Doe"
                        />
                    </div>

                    {/* Password */}
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

                    {/* Role */}
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

                    {/* Submit */}
                    <div className="flex gap-4 pt-4">
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
