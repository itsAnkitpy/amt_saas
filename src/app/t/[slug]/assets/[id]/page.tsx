import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DynamicDisplay, FieldDefinition } from "@/components/dynamic-form";
import { AssetQRCode } from "@/components/asset-qr-code";
import { PrintLabelButton } from "@/components/print-label";
import {
    ArrowLeftIcon,
    PencilIcon,
    UserPlusIcon,
    UserMinusIcon,
    TrashIcon,
} from "lucide-react";
import { AssignmentModal } from "./assignment-modal";
import { deleteAsset } from "../actions";

interface AssetDetailPageProps {
    params: Promise<{ slug: string; id: string }>;
}

const statusColors: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    MAINTENANCE: "bg-yellow-100 text-yellow-800",
    RETIRED: "bg-zinc-100 text-zinc-800",
};

const conditionColors: Record<string, string> = {
    EXCELLENT: "bg-green-100 text-green-800",
    GOOD: "bg-blue-100 text-blue-800",
    FAIR: "bg-yellow-100 text-yellow-800",
    POOR: "bg-red-100 text-red-800",
};

/**
 * Asset Detail Page
 */
export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
    const { slug, id } = await params;
    const { tenant, user } = await requireTenantAccess(slug);

    // Fetch asset with relations
    const asset = await db.asset.findUnique({
        where: { id },
        include: {
            category: true,
            assignedTo: true,
            assignments: {
                include: {
                    user: true,
                },
                orderBy: { assignedAt: "desc" },
                take: 10,
            },
        },
    });

    if (!asset || asset.tenantId !== tenant.id) {
        notFound();
    }

    // Get users for assignment modal
    const users = await db.user.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { firstName: "asc" },
    });

    const fieldSchema = asset.category.fieldSchema as FieldDefinition[];
    const customFields = asset.customFields as Record<string, unknown>;
    const isAdmin = user.role === "ADMIN" || user.isSuperAdmin;

    return (
        <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/t/${slug}/assets`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Assets
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold">{asset.name}</h2>
                        <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline">{asset.category.name}</Badge>
                            <Badge className={statusColors[asset.status]}>{asset.status}</Badge>
                            <Badge className={conditionColors[asset.condition]}>
                                {asset.condition}
                            </Badge>
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <div className="flex gap-2">
                        {asset.status === "AVAILABLE" ? (
                            <AssignmentModal
                                assetId={asset.id}
                                tenantSlug={slug}
                                users={users}
                            />
                        ) : asset.status === "ASSIGNED" ? (
                            <form action={async () => {
                                "use server";
                                const { unassignAsset } = await import("../actions");
                                await unassignAsset(slug, id);
                            }}>
                                <Button type="submit" variant="outline" size="sm">
                                    <UserMinusIcon className="mr-2 h-4 w-4" />
                                    Unassign
                                </Button>
                            </form>
                        ) : null}
                        <Link href={`/t/${slug}/assets/${id}/edit`}>
                            <Button variant="outline" size="sm">
                                <PencilIcon className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* Left Column - Details */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Basic Info */}
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">Basic Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-sm text-zinc-500">Serial Number</p>
                                <p className="font-medium">{asset.serialNumber || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Asset Tag</p>
                                <p className="font-medium">{asset.assetTag || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Location</p>
                                <p className="font-medium">{asset.location || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Category</p>
                                <p className="font-medium">{asset.category.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields */}
                    {fieldSchema.length > 0 && (
                        <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                            <h3 className="mb-4 font-semibold">{asset.category.name} Details</h3>
                            <DynamicDisplay fields={fieldSchema} values={customFields} />
                        </div>
                    )}

                    {/* Purchase Info */}
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">Purchase Information</h3>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <p className="text-sm text-zinc-500">Purchase Price</p>
                                <p className="font-medium">
                                    {asset.purchasePrice
                                        ? `₹${Number(asset.purchasePrice).toLocaleString()}`
                                        : "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Purchase Date</p>
                                <p className="font-medium">
                                    {asset.purchaseDate
                                        ? new Date(asset.purchaseDate).toLocaleDateString()
                                        : "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Warranty Until</p>
                                <p className="font-medium">
                                    {asset.warrantyEnd
                                        ? new Date(asset.warrantyEnd).toLocaleDateString()
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {asset.notes && (
                        <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                            <h3 className="mb-4 font-semibold">Notes</h3>
                            <p className="text-zinc-600 whitespace-pre-wrap">{asset.notes}</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Assignment */}
                <div className="space-y-6">
                    {/* Current Assignee */}
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">Current Assignee</h3>
                        {asset.assignedTo ? (
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                                    {asset.assignedTo.firstName[0]}
                                </div>
                                <div>
                                    <p className="font-medium">
                                        {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                    </p>
                                    <p className="text-sm text-zinc-500">{asset.assignedTo.email}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-zinc-500">Not assigned</p>
                        )}
                    </div>

                    {/* Assignment History */}
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">Assignment History</h3>
                        {asset.assignments.length === 0 ? (
                            <p className="text-sm text-zinc-500">No assignment history</p>
                        ) : (
                            <div className="space-y-4">
                                {asset.assignments.map((assignment) => (
                                    <div
                                        key={assignment.id}
                                        className="border-l-2 border-violet-200 pl-4"
                                    >
                                        <p className="font-medium">
                                            {assignment.user.firstName} {assignment.user.lastName}
                                        </p>
                                        <p className="text-sm text-zinc-500">
                                            {new Date(assignment.assignedAt).toLocaleDateString()}
                                            {assignment.returnedAt && (
                                                <> → {new Date(assignment.returnedAt).toLocaleDateString()}</>
                                            )}
                                        </p>
                                        {assignment.notes && (
                                            <p className="mt-1 text-sm text-zinc-600">
                                                {assignment.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="rounded-lg border bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
                        <p className="text-zinc-500">
                            Created: {new Date(asset.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-zinc-500">
                            Updated: {new Date(asset.updatedAt).toLocaleDateString()}
                        </p>
                    </div>

                    {/* QR Code */}
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">Asset QR Code</h3>
                        <div className="flex flex-col items-center">
                            <AssetQRCode assetId={asset.id} size={120} />
                            <p className="mt-3 text-xs text-zinc-500 text-center">
                                Scan to view this asset
                            </p>
                            <p className="mt-1 text-xs text-zinc-400 font-mono">
                                {asset.id}
                            </p>
                            <div className="mt-4">
                                <PrintLabelButton
                                    asset={{
                                        id: asset.id,
                                        name: asset.name,
                                        serialNumber: asset.serialNumber,
                                        assetTag: asset.assetTag,
                                    }}
                                    tenantName={tenant.name}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Delete */}
                    {isAdmin && (
                        <form action={async () => {
                            "use server";
                            await deleteAsset(slug, id);
                        }}>
                            <Button
                                type="submit"
                                variant="outline"
                                className="w-full text-red-600 hover:bg-red-50"
                            >
                                <TrashIcon className="mr-2 h-4 w-4" />
                                Delete Asset
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
