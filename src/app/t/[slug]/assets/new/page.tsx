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
import { createAsset } from "../actions";
import { ArrowLeftIcon, SaveIcon, Loader2Icon } from "lucide-react";

interface NewAssetPageProps {
    params: Promise<{ slug: string }>;
}

interface Category {
    id: string;
    name: string;
    fieldSchema: FieldDefinition[];
}

/**
 * Create New Asset Page
 */
export default function NewAssetPage({ params }: NewAssetPageProps) {
    const { slug } = use(params);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch categories
    useEffect(() => {
        async function fetchCategories() {
            const res = await fetch(`/api/tenants/${slug}/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
            setLoading(false);
        }
        fetchCategories();
    }, [slug]);

    const handleCategoryChange = (categoryId: string) => {
        const cat = categories.find((c) => c.id === categoryId);
        setSelectedCategory(cat || null);
        setCustomFields({}); // Reset custom fields when category changes
    };

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);

        // Add custom fields to form data
        formData.set("customFields", JSON.stringify(customFields));

        const result = await createAsset(slug, formData);
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
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/t/${slug}/assets`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Assets
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">New Asset</h2>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
                )}

                {/* Category Selection */}
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
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                                placeholder="e.g., MacBook Pro 14-inch"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="serialNumber">Serial Number</Label>
                            <Input
                                id="serialNumber"
                                name="serialNumber"
                                placeholder="Device serial number"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="assetTag">Asset Tag</Label>
                            <Input
                                id="assetTag"
                                name="assetTag"
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
                                placeholder="e.g., Office A, Desk 5"
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Fields (based on category) */}
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

                {/* Notes */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Notes</h3>
                    <textarea
                        name="notes"
                        rows={3}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="Additional notes about this asset..."
                    />
                </div>

                {/* Actions */}
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
