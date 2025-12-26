"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldBuilder, FieldDefinition } from "@/components/field-builder";
import { updateCategory, deleteCategory } from "../../actions";
import { ArrowLeftIcon, SaveIcon, Loader2Icon, TrashIcon } from "lucide-react";

interface EditCategoryPageProps {
    params: Promise<{ slug: string; id: string }>;
}

/**
 * Edit Category Page
 */
export default function EditCategoryPage({ params }: EditCategoryPageProps) {
    const { slug, id } = use(params);
    const [fields, setFields] = useState<FieldDefinition[]>([]);
    const [category, setCategory] = useState<{
        name: string;
        description: string | null;
        icon: string | null;
        isActive: boolean;
        fieldSchema: FieldDefinition[];
        _count: { assets: number };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch category data
    useEffect(() => {
        async function fetchCategory() {
            const res = await fetch(`/api/categories/${id}`);
            if (res.ok) {
                const data = await res.json();
                setCategory(data);
                setFields(data.fieldSchema || []);
            }
            setLoading(false);
        }
        fetchCategory();
    }, [id]);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);

        formData.set("fieldSchema", JSON.stringify(fields));

        try {
            await updateCategory(slug, id, formData);
            // If successful, redirect happens in server action
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update category');
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this category?")) return;

        setIsDeleting(true);
        try {
            await deleteCategory(slug, id);
            // If successful, redirect happens in server action
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete category');
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (!category) {
        return (
            <div className="py-12 text-center">
                <p className="text-zinc-500">Category not found</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/t/${slug}/settings/categories`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Categories
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">Edit: {category.name}</h2>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
                )}

                {/* Basic Info */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <h3 className="mb-4 font-semibold">Category Details</h3>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={category.name}
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                name="description"
                                defaultValue={category.description || ""}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="icon">Icon (emoji)</Label>
                            <Input
                                id="icon"
                                name="icon"
                                defaultValue={category.icon || ""}
                                maxLength={4}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                name="isActive"
                                value="true"
                                defaultChecked={category.isActive}
                                className="h-4 w-4 rounded border-zinc-300"
                            />
                            <Label htmlFor="isActive">Active</Label>
                        </div>
                    </div>
                </div>

                {/* Custom Fields */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <FieldBuilder value={fields} onChange={setFields} />
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || category._count.assets > 0}
                    >
                        {isDeleting ? (
                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <TrashIcon className="mr-2 h-4 w-4" />
                        )}
                        Delete
                    </Button>

                    <div className="flex gap-4">
                        <Link href={`/t/${slug}/settings/categories`}>
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
                </div>

                {category._count.assets > 0 && (
                    <p className="text-sm text-zinc-500">
                        This category has {category._count.assets} assets and cannot be
                        deleted.
                    </p>
                )}
            </form>
        </div>
    );
}
