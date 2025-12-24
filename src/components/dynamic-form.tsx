"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export interface FieldDefinition {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "select" | "date" | "boolean";
    required: boolean;
    placeholder?: string;
    options?: string[];
}

interface DynamicFormProps {
    fields: FieldDefinition[];
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
}

/**
 * Dynamic Form Component
 * Renders form inputs based on field definitions from category
 */
export function DynamicForm({ fields, values, onChange }: DynamicFormProps) {
    const handleChange = (key: string, value: unknown) => {
        onChange({ ...values, [key]: value });
    };

    if (fields.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {fields.map((field, fieldIndex) => (
                <div key={`dynfield-${field.key}-${fieldIndex}`} className="space-y-1">
                    <Label htmlFor={`input-${field.key}`}>
                        {field.label}
                        {field.required && <span className="text-red-500"> *</span>}
                    </Label>

                    {/* Text Input */}
                    {field.type === "text" && (
                        <Input
                            id={`input-${field.key}`}
                            name={field.key}
                            autoComplete="off"
                            placeholder={field.placeholder}
                            value={(values[field.key] as string) || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            required={field.required}
                        />
                    )}

                    {/* Textarea */}
                    {field.type === "textarea" && (
                        <textarea
                            id={`input-${field.key}`}
                            name={field.key}
                            autoComplete="off"
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            placeholder={field.placeholder}
                            rows={3}
                            value={(values[field.key] as string) || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            required={field.required}
                        />
                    )}

                    {/* Number Input */}
                    {field.type === "number" && (
                        <Input
                            id={`input-${field.key}`}
                            name={field.key}
                            type="number"
                            autoComplete="off"
                            placeholder={field.placeholder}
                            value={(values[field.key] as string) || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            required={field.required}
                        />
                    )}

                    {/* Select Dropdown */}
                    {field.type === "select" && (
                        <Select
                            value={(values[field.key] as string) || ""}
                            onValueChange={(value) => handleChange(field.key, value)}
                            required={field.required}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${field.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options?.map((option, optIndex) => (
                                    <SelectItem key={`${field.key}-opt-${optIndex}`} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Date Input */}
                    {field.type === "date" && (
                        <Input
                            id={`input-${field.key}`}
                            name={field.key}
                            type="date"
                            autoComplete="off"
                            value={(values[field.key] as string) || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            required={field.required}
                        />
                    )}

                    {/* Boolean Toggle */}
                    {field.type === "boolean" && (
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={(values[field.key] as boolean) || false}
                                onChange={(e) => handleChange(field.key, e.target.checked)}
                                className="h-4 w-4 rounded border-zinc-300"
                            />
                            <span className="text-sm text-zinc-600">Yes</span>
                        </label>
                    )}
                </div>
            ))}
        </div>
    );
}

/**
 * Display custom field values (read-only)
 */
export function DynamicDisplay({
    fields,
    values,
}: {
    fields: FieldDefinition[];
    values: Record<string, unknown>;
}) {
    if (fields.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field, fieldIndex) => {
                const value = values[field.key];
                let displayValue = "—";

                if (value !== undefined && value !== null && value !== "") {
                    if (field.type === "boolean") {
                        displayValue = value ? "Yes" : "No";
                    } else {
                        displayValue = String(value);
                    }
                }

                return (
                    <div key={`display-${fieldIndex}`}>
                        <p className="text-sm text-zinc-500">{field.label}</p>
                        <p className="font-medium">{displayValue}</p>
                    </div>
                );
            })}
        </div>
    );
}
