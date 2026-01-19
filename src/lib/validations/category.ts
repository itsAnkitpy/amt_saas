import { z } from 'zod';

// ============================================
// Field Definition Schema
// ============================================

const FieldTypeSchema = z.enum([
    'text',
    'textarea',
    'number',
    'select',
    'date',
    'boolean',
]);

/**
 * Schema for a single custom field definition
 */
const FieldDefinitionSchema = z.object({
    key: z.string().min(1, 'Field key is required'),
    label: z.string().min(1, 'Field label is required'),
    type: FieldTypeSchema,
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(), // For select fields
    helpText: z.string().optional(),
});

// ============================================
// Category Schemas
// ============================================

/**
 * Schema for creating a new asset category
 */
export const CreateCategorySchema = z.object({
    name: z
        .string()
        .min(1, 'Category name is required')
        .max(100, 'Name must be 100 characters or less'),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    fieldSchema: z.array(FieldDefinitionSchema).default([]),
});

/**
 * Schema for updating an existing category
 */
export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
    isActive: z.boolean().optional(),
});

// ============================================
// Type Exports
// ============================================

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
