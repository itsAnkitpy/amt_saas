import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

/**
 * All Users Page
 * Lists all users across all tenants for superadmin
 */
export default async function AllUsersPage() {
    // Fetch all users with their tenant info
    const users = await db.user.findMany({
        include: {
            tenant: true,
        },
        orderBy: { createdAt: "desc" },
    });

    // Role badge colors
    const roleColors: Record<string, string> = {
        SUPER_ADMIN: "bg-red-100 text-red-800",
        ADMIN: "bg-violet-100 text-violet-800",
        MANAGER: "bg-blue-100 text-blue-800",
        USER: "bg-zinc-100 text-zinc-800",
    };

    return (
        <div>
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">All Users</h2>
                <p className="mt-1 text-zinc-600">
                    View all users across all tenants
                </p>
            </div>

            {/* Stats */}
            <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-white p-4 dark:bg-zinc-950">
                    <p className="text-sm text-zinc-500">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-zinc-950">
                    <p className="text-sm text-zinc-500">Super Admins</p>
                    <p className="text-2xl font-bold">
                        {users.filter((u) => u.isSuperAdmin).length}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-zinc-950">
                    <p className="text-sm text-zinc-500">Tenant Admins</p>
                    <p className="text-2xl font-bold">
                        {users.filter((u) => u.role === "ADMIN" && !u.isSuperAdmin).length}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-zinc-950">
                    <p className="text-sm text-zinc-500">Regular Users</p>
                    <p className="text-2xl font-bold">
                        {users.filter((u) => u.role === "USER").length}
                    </p>
                </div>
            </div>

            {/* Users Table */}
            <div className="mt-8 rounded-lg border bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.firstName} {user.lastName}
                                        {user.isSuperAdmin && (
                                            <span className="ml-2 text-xs text-red-600">🔑</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge className={roleColors[user.role] || ""}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.tenant ? (
                                            <Link
                                                href={`/admin/tenants/${user.tenant.id}`}
                                                className="text-violet-600 hover:underline"
                                            >
                                                {user.tenant.name}
                                            </Link>
                                        ) : (
                                            <span className="text-zinc-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.isActive ? (
                                            <span className="text-green-600">Active</span>
                                        ) : (
                                            <span className="text-red-600">Inactive</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
