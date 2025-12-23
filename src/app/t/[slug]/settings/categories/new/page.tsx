"use client";

import { useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldBuilder, FieldDefinition } from "@/components/field-builder";
import { createCategory } from "../actions";
import { ArrowLeftIcon, SaveIcon, Loader2Icon } from "lucide-react";

interface NewCategoryPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Create New Category Page
 */
export default function NewCategoryPage({ params }: NewCategoryPageProps) {
    const { slug } = use(params);
    const [fields, setFields] = useState<FieldDefinition[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);

        // Add fields to form data
        formData.set("fieldSchema", JSON.stringify(fields));

        const result = await createCategory(slug, formData);
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
        // If successful, redirect happens in server action
    };

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
                <h2 className="text-2xl font-bold">New Category</h2>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="mt-8 space-y-6">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-red-600">
                        {error}
                    </div>
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
                                placeholder="e.g., Laptops, Monitors, Furniture"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Brief description of this category"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="icon">Icon (emoji)</Label>
                            <Input
                                id="icon"
                                name="icon"
                                placeholder="e.g., 💻, 🖥️, 🪑"
                                maxLength={4}
                            />
                            <p className="text-xs text-zinc-500">
                                Use an emoji to represent this category
                            </p>
                        </div>
                    </div>
                </div>

                {/* Custom Fields */}
                <div className="rounded-lg border bg-white p-6 dark:bg-zinc-950">
                    <FieldBuilder value={fields} onChange={setFields} />
                </div>

                {/* Field Schema Preview */}
                {fields.length > 0 && (
                    <div className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                        <p className="mb-2 text-sm font-medium text-zinc-500">
                            Form Preview
                        </p>
                        <p className="text-sm text-zinc-600">
                            Assets in this category will have these fields:
                        </p>
                        <ul className="mt-2 list-inside list-disc text-sm">
                            <li className="text-zinc-500">Name (always included)</li>
                            <li className="text-zinc-500">Serial Number (optional)</li>
                            <li className="text-zinc-500">Status & Condition (always included)</li>
                            {fields.map((field) => (
                                <li key={field.key}>
                                    {field.label}{" "}
                                    <span className="text-xs text-zinc-400">
                                        ({field.type})
                                        {field.required && " *required"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-4">
                    <Link href={`/t/${slug}/settings/categories`}>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <SaveIcon className="mr-2 h-4 w-4" />
                                Create Category
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
