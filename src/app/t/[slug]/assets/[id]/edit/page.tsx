"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DynamicForm, FieldDefinition } from "@/components/dynamic-form";
import { updateAsset } from "../../actions";
import { ArrowLeftIcon, SaveIcon, Loader2Icon } from "lucide-react";

interface EditAssetPageProps {
    params: Promise<{ slug: string; id: string }>;
}

interface Asset {
    id: string;
    name: string;
    serialNumber: string | null;
    assetTag: string | null;
    categoryId: string;
    customFields: Record<string, unknown>;
    status: string;
    condition: string;
    location: string | null;
    purchasePrice: number | null;
    purchaseDate: string | null;
    warrantyEnd: string | null;
    notes: string | null;
    category: {
        id: string;
        name: string;
        fieldSchema: FieldDefinition[];
    };
}

/**
 * Edit Asset Page
 */
export default function EditAssetPage({ params }: EditAssetPageProps) {
    const { slug, id } = use(params);
    const [asset, setAsset] = useState<Asset | null>(null);
    const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch asset data
    useEffect(() => {
        async function fetchAsset() {
            const res = await fetch(`/api/assets/${id}`);
            if (res.ok) {
                const data = await res.json();
                setAsset(data);
                setCustomFields(data.customFields || {});
            }
            setLoading(false);
        }
        fetchAsset();
    }, [id]);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);

        formData.set("customFields", JSON.stringify(customFields));

        const result = await updateAsset(slug, id, formData);
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="py-12 text-center">
                <p className="text-zinc-500">Asset not found</p>
            </div>
        );
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        return new Date(dateStr).toISOString().split("T")[0];
    };

    return (
        <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/t/${slug}/assets/${id}`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">Edit: {asset.name}</h2>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
                )}

                {/* Category (read-only) */}
                <div className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                    <p className="text-sm text-zinc-500">Category</p>
                    <p className="font-medium">{asset.category.name}</p>
                    <input type="hidden" name="categoryId" value={asset.categoryId} />
                </div>

                {/* Core Fields */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Basic Information</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="name">Asset Name *</Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={asset.name}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="serialNumber">Serial Number</Label>
                            <Input
                                id="serialNumber"
                                name="serialNumber"
                                defaultValue={asset.serialNumber || ""}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="assetTag">Asset Tag</Label>
                            <Input
                                id="assetTag"
                                name="assetTag"
                                defaultValue={asset.assetTag || ""}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="status">Status</Label>
                            <Select name="status" defaultValue={asset.status}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AVAILABLE">Available</SelectItem>
                                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                    <SelectItem value="RETIRED">Retired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="condition">Condition</Label>
                            <Select name="condition" defaultValue={asset.condition}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EXCELLENT">Excellent</SelectItem>
                                    <SelectItem value="GOOD">Good</SelectItem>
                                    <SelectItem value="FAIR">Fair</SelectItem>
                                    <SelectItem value="POOR">Poor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                name="location"
                                defaultValue={asset.location || ""}
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Fields */}
                {asset.category.fieldSchema.length > 0 && (
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">
                            {asset.category.name} Details
                        </h3>
                        <DynamicForm
                            fields={asset.category.fieldSchema}
                            values={customFields}
                            onChange={setCustomFields}
                        />
                    </div>
                )}

                {/* Financial */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Purchase Information</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <Label htmlFor="purchasePrice">Purchase Price</Label>
                            <Input
                                id="purchasePrice"
                                name="purchasePrice"
                                type="number"
                                step="0.01"
                                defaultValue={asset.purchasePrice || ""}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="purchaseDate">Purchase Date</Label>
                            <Input
                                id="purchaseDate"
                                name="purchaseDate"
                                type="date"
                                defaultValue={formatDate(asset.purchaseDate)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="warrantyEnd">Warranty End</Label>
                            <Input
                                id="warrantyEnd"
                                name="warrantyEnd"
                                type="date"
                                defaultValue={formatDate(asset.warrantyEnd)}
                            />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Notes</h3>
                    <textarea
                        name="notes"
                        rows={3}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        defaultValue={asset.notes || ""}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4">
                    <Link href={`/t/${slug}/assets/${id}`}>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <SaveIcon className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
