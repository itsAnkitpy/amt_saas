import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
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
import { ArrowLeftIcon, PencilIcon, UserPlusIcon } from "lucide-react";

interface TenantDetailPageProps {
    params: Promise<{ id: string }>;
}

/**
 * Tenant Detail Page
 * Shows tenant info and list of users
 */
export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
    const { id } = await params;

    // Fetch tenant with users
    const tenant = await db.tenant.findUnique({
        where: { id },
        include: {
            users: {
                orderBy: { createdAt: "desc" },
            },
            _count: {
                select: { assets: true },
            },
        },
    });

    if (!tenant) {
        notFound();
    }

    // Plan badge colors
    const planColors: Record<string, string> = {
        FREE: "bg-zinc-100 text-zinc-800",
        STARTER: "bg-blue-100 text-blue-800",
        PROFESSIONAL: "bg-violet-100 text-violet-800",
        ENTERPRISE: "bg-amber-100 text-amber-800",
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/tenants">
                        <Button variant="ghost" size="sm">
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold">{tenant.name}</h2>
                            <Badge className={planColors[tenant.plan] || ""}>
                                {tenant.plan}
                            </Badge>
                            {!tenant.isActive && (
                                <Badge variant="destructive">Inactive</Badge>
                            )}
                        </div>
                        <p className="text-zinc-600">
                            <code className="rounded bg-zinc-100 px-2 py-0.5 text-sm dark:bg-zinc-800">
                                {tenant.slug}
                            </code>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/admin/tenants/${tenant.id}/edit`}>
                        <Button variant="outline">
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                    </Link>
                    <Link href={`/admin/tenants/${tenant.id}/invite`}>
                        <Button>
                            <UserPlusIcon className="mr-2 h-4 w-4" />
                            Invite User
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="mt-8 grid gap-6 md:grid-cols-3">
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Users</p>
                    <p className="mt-2 text-3xl font-bold">{tenant.users.length}</p>
                </div>
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Assets</p>
                    <p className="mt-2 text-3xl font-bold">{tenant._count.assets}</p>
                </div>
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-zinc-500">Created</p>
                    <p className="mt-2 text-xl font-semibold">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Users Table */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold">Users</h3>
                <div className="mt-4 rounded-lg border bg-white dark:bg-zinc-950">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tenant.users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                                        No users in this tenant. Invite users to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tenant.users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            {user.firstName} {user.lastName}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{user.role}</Badge>
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
        </div>
    );
}
