"use client";

import { useState } from "react";
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
import { PlusIcon, TrashIcon, GripVerticalIcon } from "lucide-react";

export interface FieldDefinition {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "select" | "date" | "boolean";
    required: boolean;
    placeholder?: string;
    options?: string[];
}

interface FieldBuilderProps {
    value: FieldDefinition[];
    onChange: (fields: FieldDefinition[]) => void;
}

/**
 * Field Builder Component
 * Allows users to define custom fields for asset categories
 */
export function FieldBuilder({ value, onChange }: FieldBuilderProps) {
    const [fields, setFields] = useState<FieldDefinition[]>(value);

    const addField = () => {
        const newField: FieldDefinition = {
            key: `field_${Date.now()}`,
            label: "",
            type: "text",
            required: false,
        };
        const updated = [...fields, newField];
        setFields(updated);
        onChange(updated);
    };

    const updateField = (index: number, updates: Partial<FieldDefinition>) => {
        const updated = fields.map((field, i) => {
            if (i === index) {
                const newField = { ...field, ...updates };
                // Auto-generate key from label if label changes
                if (updates.label && !field.key.startsWith("field_")) {
                    // Keep existing key
                } else if (updates.label) {
                    newField.key = updates.label
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "_")
                        .replace(/_+/g, "_")
                        .replace(/^_|_$/g, "");
                }
                return newField;
            }
            return field;
        });
        setFields(updated);
        onChange(updated);
    };

    const removeField = (index: number) => {
        const updated = fields.filter((_, i) => i !== index);
        setFields(updated);
        onChange(updated);
    };

    const updateOptions = (index: number, optionsString: string) => {
        const options = optionsString
            .split(",")
            .map((o) => o.trim())
            .filter((o) => o);
        updateField(index, { options });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Custom Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Field
                </Button>
            </div>

            {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-zinc-500">
                    <p className="mb-2">No custom fields defined</p>
                    <p className="text-sm">
                        Add fields to capture specific information for assets in this
                        category
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div
                            key={field.key}
                            className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <GripVerticalIcon className="h-4 w-4" />
                                    <span>Field {index + 1}</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => removeField(index)}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                {/* Label */}
                                <div className="space-y-1">
                                    <Label className="text-xs">Label</Label>
                                    <Input
                                        placeholder="e.g., Processor"
                                        value={field.label}
                                        onChange={(e) =>
                                            updateField(index, { label: e.target.value })
                                        }
                                    />
                                </div>

                                {/* Type */}
                                <div className="space-y-1">
                                    <Label className="text-xs">Type</Label>
                                    <Select
                                        value={field.type}
                                        onValueChange={(value) =>
                                            updateField(index, {
                                                type: value as FieldDefinition["type"],
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Text</SelectItem>
                                            <SelectItem value="textarea">Long Text</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="select">Dropdown</SelectItem>
                                            <SelectItem value="date">Date</SelectItem>
                                            <SelectItem value="boolean">Yes/No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Required */}
                                <div className="flex items-end gap-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(e) =>
                                                updateField(index, { required: e.target.checked })
                                            }
                                            className="h-4 w-4 rounded border-zinc-300"
                                        />
                                        Required
                                    </label>
                                </div>
                            </div>

                            {/* Options for select type */}
                            {field.type === "select" && (
                                <div className="mt-3 space-y-1">
                                    <Label className="text-xs">
                                        Options (comma separated)
                                    </Label>
                                    <Input
                                        placeholder="e.g., 8GB, 16GB, 32GB"
                                        value={field.options?.join(", ") || ""}
                                        onChange={(e) => updateOptions(index, e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Placeholder for text types */}
                            {(field.type === "text" || field.type === "textarea") && (
                                <div className="mt-3 space-y-1">
                                    <Label className="text-xs">Placeholder (optional)</Label>
                                    <Input
                                        placeholder="e.g., Enter processor model"
                                        value={field.placeholder || ""}
                                        onChange={(e) =>
                                            updateField(index, { placeholder: e.target.value })
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Hidden input to pass field schema to form */}
            <input
                type="hidden"
                name="fieldSchema"
                value={JSON.stringify(fields)}
            />
        </div>
    );
}
