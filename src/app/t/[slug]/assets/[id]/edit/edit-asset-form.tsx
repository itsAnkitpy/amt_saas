"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { DynamicForm, type FieldDefinition } from "@/components/dynamic-form";
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
import { updateAsset } from "../../actions";

interface EditAsset {
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

interface EditAssetFormProps {
    slug: string;
    asset: EditAsset;
}

export function EditAssetForm({ slug, asset }: EditAssetFormProps) {
    const [customFields, setCustomFields] = useState<Record<string, unknown>>(
        asset.customFields || {}
    );
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);
        formData.set("customFields", JSON.stringify(customFields));

        const result = await updateAsset(slug, asset.id, formData);
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        return new Date(dateStr).toISOString().split("T")[0];
    };

    return (
        <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-4">
                <Link href={`/t/${slug}/assets/${asset.id}`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">Edit: {asset.name}</h2>
            </div>

            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
                )}

                <div className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                    <p className="text-sm text-zinc-500">Category</p>
                    <p className="font-medium">{asset.category.name}</p>
                    <input type="hidden" name="categoryId" value={asset.categoryId} />
                </div>

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

                {asset.category.fieldSchema.length > 0 && (
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">{asset.category.name} Details</h3>
                        <DynamicForm
                            fields={asset.category.fieldSchema}
                            values={customFields}
                            onChange={setCustomFields}
                        />
                    </div>
                )}

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

                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Notes</h3>
                    <textarea
                        name="notes"
                        rows={3}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        defaultValue={asset.notes || ""}
                    />
                </div>

                <div className="flex justify-end gap-4">
                    <Link href={`/t/${slug}/assets/${asset.id}`}>
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
