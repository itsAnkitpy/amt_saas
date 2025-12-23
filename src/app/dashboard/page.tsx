import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { syncUser } from "@/lib/sync-user";

export default async function DashboardPage() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        redirect("/sign-in");
    }

    // Sync user to our database (creates if not exists)
    const dbUser = await syncUser();

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-zinc-900">
                <h1 className="text-xl font-bold">AMT SaaS</h1>
                <UserButton afterSwitchSessionUrl="/" />
            </header>

            {/* Main Content */}
            <main className="p-6">
                <div className="mx-auto max-w-4xl">
                    <h2 className="text-2xl font-bold">Dashboard</h2>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                        Welcome back, {clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress}!
                    </p>

                    {/* User Info Card */}
                    <div className="mt-6 rounded-lg border bg-white p-6 dark:bg-zinc-900">
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
                                        <span className="text-zinc-500">Tenant ID:</span> {dbUser.tenantId}
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
