import Link from "next/link";
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
import { PlusIcon, EyeIcon } from "lucide-react";

/**
 * Tenants List Page
 * Shows all tenants with their details and user counts
 */
export default async function TenantsListPage() {
    // Fetch tenants with user count
    const tenants = await db.tenant.findMany({
        include: {
            _count: {
                select: { users: true, assets: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

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
                <div>
                    <h2 className="text-2xl font-bold">Tenants</h2>
                    <p className="mt-1 text-zinc-600">
                        Manage all organizations using your platform
                    </p>
                </div>
                <Link href="/admin/tenants/new">
                    <Button>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Create Tenant
                    </Button>
                </Link>
            </div>

            {/* Tenants Table */}
            <div className="mt-8 rounded-lg border bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-center">Users</TableHead>
                            <TableHead className="text-center">Assets</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tenants.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                                    No tenants yet. Create your first tenant to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tenants.map((tenant) => (
                                <TableRow key={tenant.id}>
                                    <TableCell className="font-medium">{tenant.name}</TableCell>
                                    <TableCell>
                                        <code className="rounded bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-800">
                                            {tenant.slug}
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={planColors[tenant.plan] || ""}>
                                            {tenant.plan}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {tenant._count.users}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {tenant._count.assets}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(tenant.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/admin/tenants/${tenant.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <EyeIcon className="mr-1 h-4 w-4" />
                                                View
                                            </Button>
                                        </Link>
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
