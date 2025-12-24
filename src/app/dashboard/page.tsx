import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { syncUser } from "@/lib/sync-user";
import { db } from "@/lib/db";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        redirect("/sign-in");
    }

    // Sync user to our database (creates if not exists)
    const dbUser = await syncUser();

    // If user has a tenant, get the tenant slug for navigation
    let tenantSlug: string | null = null;
    if (dbUser?.tenantId) {
        const tenant = await db.tenant.findUnique({
            where: { id: dbUser.tenantId },
            select: { slug: true },
        });
        tenantSlug = tenant?.slug || null;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-zinc-900">
                <h1 className="text-xl font-bold">AMT SaaS</h1>
                <div className="flex items-center gap-4">
                    {dbUser?.isSuperAdmin && (
                        <Link
                            href="/admin"
                            className="text-sm font-medium text-violet-600 hover:text-violet-700"
                        >
                            Admin Panel
                        </Link>
                    )}
                    {tenantSlug && (
                        <Link
                            href={`/t/${tenantSlug}/dashboard`}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                            My Workspace →
                        </Link>
                    )}
                    <ThemeToggle />
                    <UserButton afterSwitchSessionUrl="/" />
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                <div className="mx-auto max-w-4xl">
                    <h2 className="text-2xl font-bold">Dashboard</h2>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                        Welcome back, {clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress}!
                    </p>

                    {/* Quick Access Cards */}
                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        {/* Superadmin Card */}
                        {dbUser?.isSuperAdmin && (
                            <Link
                                href="/admin"
                                className="rounded-lg border bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
                            >
                                <h3 className="text-lg font-bold">🔑 Super Admin Panel</h3>
                                <p className="mt-2 text-violet-100">
                                    Manage all tenants and users across the platform.
                                </p>
                            </Link>
                        )}

                        {/* Tenant Workspace Card */}
                        {tenantSlug && (
                            <Link
                                href={`/t/${tenantSlug}/dashboard`}
                                className="rounded-lg border bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
                            >
                                <h3 className="text-lg font-bold">📦 My Workspace</h3>
                                <p className="mt-2 text-emerald-100">
                                    Access your organization&apos;s assets and team.
                                </p>
                            </Link>
                        )}
                    </div>

                    {/* User Info Card */}
                    <div className="mt-8 rounded-lg border bg-white p-6 dark:bg-zinc-900">
                        <h3 className="font-semibold">Your Account</h3>
                        <div className="mt-4 space-y-2 text-sm">
                            <p>
                                <span className="text-zinc-500">Email:</span>{" "}
                                {clerkUser.emailAddresses[0]?.emailAddress}
                            </p>
                            <p>
                                <span className="text-zinc-500">Clerk ID:</span> {clerkUser.id}
                            </p>
                            <p>
                                <span className="text-zinc-500">Joined:</span>{" "}
                                {new Date(clerkUser.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* Database Sync Status */}
                    <div className="mt-4 rounded-lg border bg-white p-6 dark:bg-zinc-900">
                        <h3 className="font-semibold">Database Status</h3>
                        <div className="mt-4 space-y-2 text-sm">
                            {dbUser ? (
                                <>
                                    <p className="text-green-600">✅ User synced to PostgreSQL</p>
                                    <p>
                                        <span className="text-zinc-500">DB User ID:</span> {dbUser.id}
                                    </p>
                                    <p>
                                        <span className="text-zinc-500">Role:</span>{" "}
                                        {dbUser.isSuperAdmin ? "🔑 Super Admin" : dbUser.role}
                                    </p>
                                    <p>
                                        <span className="text-zinc-500">Tenant:</span>{" "}
                                        {dbUser.tenantId || "None (Super Admin)"}
                                    </p>
                                </>
                            ) : (
                                <p className="text-red-600">❌ User not synced to database</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
