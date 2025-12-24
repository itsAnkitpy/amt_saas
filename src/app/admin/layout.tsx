import { requireSuperAdmin } from "@/lib/auth";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    BoxIcon,
    BuildingIcon,
    LayoutDashboardIcon,
    UsersIcon,
} from "lucide-react";

/**
 * Admin Layout
 * 
 * This layout wraps all /admin/* routes.
 * It requires the user to be a superadmin.
 * Non-superadmins are redirected to /dashboard.
 */
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // This will redirect to /dashboard if not superadmin
    const user = await requireSuperAdmin();

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-zinc-900 text-white">
                {/* Logo */}
                <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-6">
                    <BoxIcon className="h-6 w-6" />
                    <span className="font-bold">AMT Admin</span>
                </div>

                {/* Navigation */}
                <nav className="p-4">
                    <ul className="space-y-2">
                        <li>
                            <Link
                                href="/admin"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                                <LayoutDashboardIcon className="h-5 w-5" />
                                Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/tenants"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                                <BuildingIcon className="h-5 w-5" />
                                Tenants
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/users"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                                <UsersIcon className="h-5 w-5" />
                                All Users
                            </Link>
                        </li>
                    </ul>
                </nav>

                {/* Bottom Section */}
                <div className="absolute bottom-0 w-64 border-t border-zinc-800 p-4">
                    <Link
                        href="/dashboard"
                        className="block text-sm text-zinc-500 hover:text-white"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Header */}
                <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-zinc-950">
                    <h1 className="text-lg font-semibold">Super Admin Panel</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-500">{user.email}</span>
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
