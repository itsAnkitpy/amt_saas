import Link from "next/link";
import { createTenant } from "../actions";
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

/**
 * Create Tenant Page
 */
export default function CreateTenantPage() {
    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/tenants">
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold">Create Tenant</h2>
                    <p className="text-zinc-600">Add a new organization to the platform</p>
                </div>
            </div>

            {/* Form */}
            <div className="mt-8 max-w-lg">
                <form action={createTenant} className="space-y-6">
                    {/* Tenant Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Tenant Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="Acme Corporation"
                            required
                        />
                        <p className="text-sm text-zinc-500">
                            The display name for this organization
                        </p>
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug *</Label>
                        <Input
                            id="slug"
                            name="slug"
                            placeholder="acme-corp"
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
                        <Select name="plan" defaultValue="FREE">
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

                    {/* Submit */}
                    <div className="flex gap-4 pt-4">
                        <Button type="submit">Create Tenant</Button>
                        <Link href="/admin/tenants">
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
