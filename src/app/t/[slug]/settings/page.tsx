import Link from "next/link";
import { requireTenantAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FolderIcon, UsersIcon, SettingsIcon } from "lucide-react";

interface SettingsPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Tenant Settings Page
 */
export default async function SettingsPage({ params }: SettingsPageProps) {
    const { slug } = await params;
    const { user, tenant } = await requireTenantAccess(slug);

    // Only admins can access settings
    if (user.role !== "ADMIN" && !user.isSuperAdmin) {
        return (
            <div className="py-12 text-center">
                <p className="text-zinc-500">You don&apos;t have access to settings</p>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="mt-2 text-zinc-600">
                Manage your organization&apos;s settings
            </p>

            {/* Settings Grid */}
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Categories */}
                <Link href={`/t/${slug}/settings/categories`}>
                    <div className="rounded-lg border bg-white p-6 transition-shadow hover:shadow-md dark:bg-zinc-950">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                            <FolderIcon className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold">Asset Categories</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                            Define categories and custom fields for your assets
                        </p>
                    </div>
                </Link>

                {/* Team */}
                <Link href={`/t/${slug}/users`}>
                    <div className="rounded-lg border bg-white p-6 transition-shadow hover:shadow-md dark:bg-zinc-950">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <UsersIcon className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold">Team Members</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                            Manage users and their roles
                        </p>
                    </div>
                </Link>

                {/* General */}
                <div className="rounded-lg border bg-white p-6 opacity-50 dark:bg-zinc-950">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                        <SettingsIcon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold">General</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                        Organization settings (coming soon)
                    </p>
                </div>
            </div>

            {/* Tenant Info */}
            <div className="mt-8 rounded-lg border bg-zinc-50 p-6 dark:bg-zinc-900">
                <h3 className="font-semibold">Organization Info</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <p className="text-sm text-zinc-500">Name</p>
                        <p className="font-medium">{tenant.name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500">Slug</p>
                        <p className="font-medium">{tenant.slug}</p>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500">Plan</p>
                        <p className="font-medium">{tenant.plan}</p>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500">Created</p>
                        <p className="font-medium">
                            {new Date(tenant.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
