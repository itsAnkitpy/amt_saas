import { requireTenantAccess } from "@/lib/auth";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    BoxIcon,
    LayoutDashboardIcon,
    PackageIcon,
    UsersIcon,
    SettingsIcon,
} from "lucide-react";

interface TenantLayoutProps {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}

/**
 * Tenant Layout
 * 
 * This layout wraps all /t/[slug]/* routes.
 * It requires the user to have access to the tenant.
 */
export default async function TenantLayout({
    children,
    params,
}: TenantLayoutProps) {
    const { slug } = await params;

    // This will redirect to /dashboard if user doesn't have access
    const { user, tenant } = await requireTenantAccess(slug);

    const isAdmin = user.role === "ADMIN" || user.isSuperAdmin;

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-white dark:bg-zinc-950">
                {/* Logo */}
                <div className="flex h-16 items-center gap-2 border-b px-6">
                    <BoxIcon className="h-6 w-6 text-violet-600" />
                    <div>
                        <span className="font-bold">{tenant.name}</span>
                        <p className="text-xs text-zinc-500">{tenant.plan} Plan</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4">
                    <ul className="space-y-2">
                        <li>
                            <Link
                                href={`/t/${slug}/dashboard`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                                <LayoutDashboardIcon className="h-5 w-5" />
                                Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link
                                href={`/t/${slug}/assets`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                                <PackageIcon className="h-5 w-5" />
                                Assets
                            </Link>
                        </li>
                        {isAdmin && (
                            <>
                                <li>
                                    <Link
                                        href={`/t/${slug}/users`}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                    >
                                        <UsersIcon className="h-5 w-5" />
                                        Users
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={`/t/${slug}/settings`}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                    >
                                        <SettingsIcon className="h-5 w-5" />
                                        Settings
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>

                {/* Superadmin Quick Link */}
                {user.isSuperAdmin && (
                    <div className="absolute bottom-16 w-64 border-t p-4">
                        <Link
                            href="/admin"
                            className="block text-sm text-violet-600 hover:underline"
                        >
                            ← Back to Admin Panel
                        </Link>
                    </div>
                )}

                {/* Bottom Section */}
                <div className="absolute bottom-0 w-64 border-t p-4">
                    <Link
                        href="/dashboard"
                        className="block text-sm text-zinc-500 hover:text-zinc-900"
                    >
                        ← My Account
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Header */}
                <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-zinc-950">
                    <h1 className="text-lg font-semibold">{tenant.name}</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-500">
                            {user.firstName} ({user.role})
                        </span>
                        <ThemeToggle />
                        <UserButton afterSwitchSessionUrl="/" />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 bg-zinc-50 p-6 dark:bg-zinc-900">
                    {children}
                </main>
            </div>
        </div>
    );
}
