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
import { PlusIcon, PencilIcon, ArrowLeftIcon } from "lucide-react";

interface CategoriesPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Categories List Page
 */
export default async function CategoriesPage({ params }: CategoriesPageProps) {
    const { slug } = await params;
    const { tenant } = await requireTenantAccess(slug);

    // Fetch categories with asset count
    const categories = await db.assetCategory.findMany({
        where: { tenantId: tenant.id },
        include: {
            _count: {
                select: { assets: true },
            },
        },
        orderBy: { name: "asc" },
    });

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/t/${slug}/settings`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold">Asset Categories</h2>
                        <p className="text-zinc-600">
                            Define categories and custom fields for your assets
                        </p>
                    </div>
                </div>
                <Link href={`/t/${slug}/settings/categories/new`}>
                    <Button>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Category
                    </Button>
                </Link>
            </div>

            {/* Categories Table */}
            <div className="mt-8 rounded-lg border bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Custom Fields</TableHead>
                            <TableHead>Assets</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center">
                                    <div className="text-zinc-500">
                                        <p className="mb-2">No categories yet</p>
                                        <Link href={`/t/${slug}/settings/categories/new`}>
                                            <Button variant="outline" size="sm">
                                                <PlusIcon className="mr-2 h-4 w-4" />
                                                Create your first category
                                            </Button>
                                        </Link>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            categories.map((category) => {
                                const fieldSchema = category.fieldSchema as Array<{ key: string; label: string }>;
                                return (
                                    <TableRow key={category.id}>
                                        <TableCell className="font-medium">
                                            {category.icon && (
                                                <span className="mr-2">{category.icon}</span>
                                            )}
                                            {category.name}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate text-zinc-500">
                                            {category.description || "—"}
                                        </TableCell>
                                        <TableCell>
                                            {fieldSchema.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {fieldSchema.slice(0, 3).map((field, idx) => (
                                                        <Badge
                                                            key={`${category.id}-field-${idx}`}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {field.label}
                                                        </Badge>
                                                    ))}
                                                    {fieldSchema.length > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{fieldSchema.length - 3} more
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400">No custom fields</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{category._count.assets}</TableCell>
                                        <TableCell>
                                            {category.isActive ? (
                                                <Badge className="bg-green-100 text-green-800">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/t/${slug}/settings/categories/${category.id}/edit`}>
                                                <Button variant="ghost" size="sm">
                                                    <PencilIcon className="h-4 w-4" />
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
