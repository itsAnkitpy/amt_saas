import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";

interface UsersPageProps {
    params: Promise<{ slug: string }>;
}

const roleColors: Record<string, string> = {
    ADMIN: "bg-violet-100 text-violet-800",
    MANAGER: "bg-blue-100 text-blue-800",
    USER: "bg-zinc-100 text-zinc-800",
};

/**
 * Tenant Users Page
 */
export default async function UsersPage({ params }: UsersPageProps) {
    const { slug } = await params;
    const { tenant, user: currentUser } = await requireTenantAccess(slug);

    // Only admins can view users
    if (currentUser.role !== "ADMIN" && !currentUser.isSuperAdmin) {
        return (
            <div className="py-12 text-center">
                <p className="text-zinc-500">You don&apos;t have access to this page</p>
            </div>
        );
    }

    // Fetch users with asset count
    const users = await db.user.findMany({
        where: { tenantId: tenant.id },
        include: {
            _count: {
                select: { assets: true },
            },
            department: true,
        },
        orderBy: { firstName: "asc" },
    });

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/t/${slug}/dashboard`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Dashboard
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold">Team Members</h2>
                        <p className="text-zinc-600">{users.length} users in {tenant.name}</p>
                    </div>
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
                            <TableHead>Department</TableHead>
                            <TableHead>Assets</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center">
                                    <div className="text-zinc-500">
                                        <UsersIcon className="mx-auto mb-2 h-8 w-8" />
                                        <p>No team members found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-sm font-medium">
                                                {user.firstName[0]}
                                                {user.lastName?.[0] || ""}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {user.firstName} {user.lastName}
                                                </p>
                                                {user.id === currentUser.id && (
                                                    <span className="text-xs text-zinc-400">(You)</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-500">{user.email}</TableCell>
                                    <TableCell>
                                        <Badge className={roleColors[user.role] || roleColors.USER}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.department?.name || (
                                            <span className="text-zinc-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{user._count.assets}</TableCell>
                                    <TableCell>
                                        {user.isActive ? (
                                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                                        ) : (
                                            <Badge variant="secondary">Inactive</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Info */}
            <div className="mt-6 rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                <p className="text-sm text-zinc-600">
                    💡 To add new team members, contact your superadmin or use the Admin Panel.
                </p>
            </div>
        </div>
    );
}
