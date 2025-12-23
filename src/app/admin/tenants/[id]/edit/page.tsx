import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateTenant, deleteTenant } from "../../actions";
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
import { ArrowLeftIcon, TrashIcon } from "lucide-react";

interface EditTenantPageProps {
    params: Promise<{ id: string }>;
}

/**
 * Edit Tenant Page
 */
export default async function EditTenantPage({ params }: EditTenantPageProps) {
    const { id } = await params;

    const tenant = await db.tenant.findUnique({
        where: { id },
    });

    if (!tenant) {
        notFound();
    }

    // Bind the action with tenant ID
    const updateTenantWithId = updateTenant.bind(null, tenant.id);
    const deleteTenantWithId = deleteTenant.bind(null, tenant.id);

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
                    <h2 className="text-2xl font-bold">Edit Tenant</h2>
                    <p className="text-zinc-600">Update {tenant.name}</p>
                </div>
            </div>

            {/* Form */}
            <div className="mt-8 max-w-lg">
                <form action={updateTenantWithId} className="space-y-6">
                    {/* Tenant Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Tenant Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            defaultValue={tenant.name}
                            required
                        />
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug *</Label>
                        <Input
                            id="slug"
                            name="slug"
                            defaultValue={tenant.slug}
                            pattern="[a-z0-9-]+"
                            required
                        />
                        <p className="text-sm text-zinc-500">
                            URL-friendly identifier (lowercase, hyphens only)
                        </p>
                    </div>

                    {/* Plan */}
                    <div className="space-y-2">
                        <Label htmlFor="plan">Plan</Label>
                        <Select name="plan" defaultValue={tenant.plan}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FREE">Free</SelectItem>
                                <SelectItem value="STARTER">Starter</SelectItem>
                                <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Active Status */}
                    <div className="space-y-2">
                        <Label htmlFor="isActive">Status</Label>
                        <Select name="isActive" defaultValue={tenant.isActive ? "true" : "false"}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Active</SelectItem>
                                <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-4 pt-4">
                        <Button type="submit">Save Changes</Button>
                        <Link href={`/admin/tenants/${tenant.id}`}>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </Link>
                    </div>
                </form>

                {/* Delete Section */}
                <div className="mt-12 border-t pt-8">
                    <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
                    <p className="mt-2 text-sm text-zinc-600">
                        Deleting this tenant will remove all users and assets. This action cannot be undone.
                    </p>
                    <form action={deleteTenantWithId} className="mt-4">
                        <Button type="submit" variant="destructive">
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete Tenant
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
