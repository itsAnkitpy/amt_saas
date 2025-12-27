import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AssetsTable } from "@/components/assets-table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/components/ui/pagination";
import { PlusIcon, SearchIcon } from "lucide-react";

interface AssetsPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{
        search?: string;
        status?: string;
        category?: string;
        page?: string;
    }>;
}

const PAGE_SIZE = 10;

/**
 * Asset List Page with Pagination
 */
export default async function AssetsPage({ params, searchParams }: AssetsPageProps) {
    const { slug } = await params;
    const { search, status, category, page } = await searchParams;
    const { tenant } = await requireTenantAccess(slug);

    const currentPage = Math.max(1, parseInt(page || "1", 10));
    const skip = (currentPage - 1) * PAGE_SIZE;

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

    // Count total assets for pagination
    const totalAssets = await db.asset.count({ where });
    const totalPages = Math.ceil(totalAssets / PAGE_SIZE);

    // Fetch assets with pagination
    const assetsRaw = await db.asset.findMany({
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
        skip,
        take: PAGE_SIZE,
    });

    // Serialize for client component (convert Decimal to number)
    const assets = assetsRaw.map(asset => ({
        ...asset,
        purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
    }));

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

    const allAssetsCount = stats.reduce((sum, s) => sum + s._count, 0);
    const availableCount = stats.find((s) => s.status === "AVAILABLE")?._count || 0;
    const assignedCount = stats.find((s) => s.status === "ASSIGNED")?._count || 0;

    // Build URL for pagination (preserve filters)
    const buildPageUrl = (pageNum: number) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        if (category) params.set("category", category);
        params.set("page", pageNum.toString());
        return `/t/${slug}/assets?${params.toString()}`;
    };

    // Calculate visible page numbers (show 5 pages max)
    const getVisiblePages = () => {
        const pages: number[] = [];
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Assets</h2>
                    <p className="text-muted-foreground">
                        {allAssetsCount} total • {availableCount} available • {assignedCount} assigned
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
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            name="search"
                            type="text"
                            placeholder="Search by name, serial, or tag..."
                            defaultValue={search}
                            className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>
                <select
                    name="status"
                    defaultValue={status}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
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
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
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

            {/* Assets Table with Multi-Select */}
            <div className="mt-6">
                <AssetsTable assets={assets} tenantSlug={slug} categories={categories} />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {skip + 1}-{Math.min(skip + PAGE_SIZE, totalAssets)} of {totalAssets} assets
                    </p>
                    <Pagination>
                        <PaginationContent>
                            {currentPage > 1 && (
                                <PaginationItem>
                                    <PaginationPrevious href={buildPageUrl(currentPage - 1)} />
                                </PaginationItem>
                            )}

                            {getVisiblePages().map((pageNum) => (
                                <PaginationItem key={pageNum}>
                                    <PaginationLink
                                        href={buildPageUrl(pageNum)}
                                        isActive={pageNum === currentPage}
                                    >
                                        {pageNum}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}

                            {currentPage < totalPages && (
                                <PaginationItem>
                                    <PaginationNext href={buildPageUrl(currentPage + 1)} />
                                </PaginationItem>
                            )}
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
