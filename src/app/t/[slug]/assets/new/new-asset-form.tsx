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
import { createAsset } from "../actions";

interface CategoryOption {
    id: string;
    name: string;
    fieldSchema: FieldDefinition[];
}

interface NewAssetFormProps {
    slug: string;
    categories: CategoryOption[];
    prefillSerial: string;
}

export function NewAssetForm({
    slug,
    categories,
    prefillSerial,
}: NewAssetFormProps) {
    const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(
        null
    );
    const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCategoryChange = (categoryId: string) => {
        const category = categories.find((item) => item.id === categoryId) ?? null;
        setSelectedCategory(category);
        setCustomFields({});
    };

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);
        formData.set("customFields", JSON.stringify(customFields));

        const result = await createAsset(slug, formData);
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    if (categories.length === 0) {
        return (
            <div className="mx-auto max-w-xl py-12 text-center">
                <h2 className="text-xl font-bold">No Categories Found</h2>
                <p className="mt-2 text-zinc-600">
                    You need to create at least one asset category before adding assets.
                </p>
                <Link href={`/t/${slug}/settings/categories/new`}>
                    <Button className="mt-4">Create Category</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-4">
                <Link href={`/t/${slug}/assets`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Assets
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">New Asset</h2>
            </div>

            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
                )}

                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Category</h3>
                    <div className="space-y-1">
                        <Label htmlFor="categoryId">Select Category *</Label>
                        <Select
                            name="categoryId"
                            onValueChange={handleCategoryChange}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Basic Information</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="name">Asset Name *</Label>
                            <Input
                                id="name"
                                name="name"
                                autoComplete="off"
                                placeholder="e.g., MacBook Pro 14-inch"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="serialNumber">Serial Number</Label>
                            <Input
                                id="serialNumber"
                                name="serialNumber"
                                autoComplete="off"
                                defaultValue={prefillSerial}
                                placeholder="Device serial number"
                            />
                            {prefillSerial && (
                                <p className="text-xs text-green-600">Pre-filled from scan</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="assetTag">Asset Tag</Label>
                            <Input
                                id="assetTag"
                                name="assetTag"
                                autoComplete="off"
                                placeholder="e.g., IT-0001"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="status">Status</Label>
                            <Select name="status" defaultValue="AVAILABLE">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AVAILABLE">Available</SelectItem>
                                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                    <SelectItem value="RETIRED">Retired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="condition">Condition</Label>
                            <Select name="condition" defaultValue="GOOD">
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
                                autoComplete="off"
                                placeholder="e.g., Office A, Desk 5"
                            />
                        </div>
                    </div>
                </div>

                {selectedCategory && selectedCategory.fieldSchema.length > 0 && (
                    <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                        <h3 className="mb-4 font-semibold">
                            {selectedCategory.name} Details
                        </h3>
                        <DynamicForm
                            fields={selectedCategory.fieldSchema}
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
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="purchaseDate">Purchase Date</Label>
                            <Input id="purchaseDate" name="purchaseDate" type="date" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="warrantyEnd">Warranty End</Label>
                            <Input id="warrantyEnd" name="warrantyEnd" type="date" />
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Notes</h3>
                    <textarea
                        name="notes"
                        rows={3}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="Additional notes about this asset..."
                    />
                </div>

                <div className="flex justify-end gap-4">
                    <Link href={`/t/${slug}/assets`}>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting || !selectedCategory}>
                        {isSubmitting ? (
                            <>
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <SaveIcon className="mr-2 h-4 w-4" />
                                Create Asset
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
