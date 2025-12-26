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
import { PlusIcon, EyeIcon, SearchIcon, ImageIcon } from "lucide-react";

interface AssetsPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ search?: string; status?: string; category?: string }>;
}

const statusColors: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    MAINTENANCE: "bg-yellow-100 text-yellow-800",
    RETIRED: "bg-zinc-100 text-zinc-800",
};

/**
 * Asset List Page
 */
export default async function AssetsPage({ params, searchParams }: AssetsPageProps) {
    const { slug } = await params;
    const { search, status, category } = await searchParams;
    const { tenant } = await requireTenantAccess(slug);

    // Build where clause
    const where: Record<string, unknown> = { tenantId: tenant.id };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { serialNumber: { contains: search, mode: "insensitive" } },
            { assetTag: { contains: search, mode: "insensitive" } },
        ];
    }
    if (status) {
        where.status = status;
    }
    if (category) {
        where.categoryId = category;
    }

    // Fetch assets with primary image
    const assets = await db.asset.findMany({
        where,
        include: {
            category: true,
            assignedTo: true,
            images: {
                where: { isPrimary: true },
                take: 1,
            },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    // Fetch categories for filter
    const categories = await db.assetCategory.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: "asc" },
    });

    // Stats
    const stats = await db.asset.groupBy({
        by: ["status"],
        where: { tenantId: tenant.id },
        _count: true,
    });

    const totalAssets = stats.reduce((sum, s) => sum + s._count, 0);
    const availableCount = stats.find((s) => s.status === "AVAILABLE")?._count || 0;
    const assignedCount = stats.find((s) => s.status === "ASSIGNED")?._count || 0;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Assets</h2>
                    <p className="text-zinc-600">
                        {totalAssets} total • {availableCount} available • {assignedCount} assigned
                    </p>
                </div>
                <Link href={`/t/${slug}/assets/new`}>
                    <Button>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Add Asset
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <form className="mt-6 flex flex-wrap gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            name="search"
                            type="text"
                            placeholder="Search by name, serial, or tag..."
                            defaultValue={search}
                            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>
                <select
                    name="status"
                    defaultValue={status}
                    className="rounded-lg border px-3 py-2 text-sm"
                >
                    <option value="">All Status</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RETIRED">Retired</option>
                </select>
                <select
                    name="category"
                    defaultValue={category}
                    className="rounded-lg border px-3 py-2 text-sm"
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>
                <Button type="submit" variant="secondary">
                    Filter
                </Button>
            </form>

            {/* Assets Table */}
            <div className="mt-6 rounded-lg border bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Serial / Tag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12 text-center">
                                    <div className="text-zinc-500">
                                        <p className="mb-2">No assets found</p>
                                        <Link href={`/t/${slug}/assets/new`}>
                                            <Button variant="outline" size="sm">
                                                <PlusIcon className="mr-2 h-4 w-4" />
                                                Add your first asset
                                            </Button>
                                        </Link>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            assets.map((asset) => {
                                const primaryImage = asset.images[0];
                                return (
                                    <TableRow key={asset.id}>
                                        {/* Thumbnail */}
                                        <TableCell className="w-16 py-2">
                                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                {primaryImage ? (
                                                    <img
                                                        src={`/api/images/${primaryImage.id}/thumb`}
                                                        alt={asset.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-5 w-5 text-zinc-400" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{asset.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{asset.category.name}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-500">
                                            {asset.serialNumber || asset.assetTag || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={statusColors[asset.status]}>
                                                {asset.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {asset.assignedTo ? (
                                                <span className="text-sm">
                                                    {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/t/${slug}/assets/${asset.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <EyeIcon className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
