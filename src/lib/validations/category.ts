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

const MaintenanceIntervalUnitSchema = z.enum([
    'DAYS',
    'WEEKS',
    'MONTHS',
    'YEARS',
]);

const OptionalPositiveIntSchema = z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
        return undefined;
    }

    return value;
}, z.coerce.number().int().min(1).optional());

const OptionalStringSchema = z.preprocess((value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}, z.string().max(2000).nullable().optional());

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
const CategorySchemaBase = z.object({
    name: z
        .string()
        .min(1, 'Category name is required')
        .max(100, 'Name must be 100 characters or less'),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    fieldSchema: z.array(FieldDefinitionSchema).default([]),
    defaultMaintenanceIntervalValue: OptionalPositiveIntSchema,
    defaultMaintenanceIntervalUnit: z
        .preprocess((value) => {
            if (value === '' || value === null || value === undefined) {
                return undefined;
            }

            return value;
        }, MaintenanceIntervalUnitSchema.optional()),
    defaultMaintenanceInstructions: OptionalStringSchema,
});

function refineMaintenanceDefaults(
    data: {
        defaultMaintenanceIntervalValue?: number;
        defaultMaintenanceIntervalUnit?: z.infer<typeof MaintenanceIntervalUnitSchema>;
    },
    ctx: z.RefinementCtx
) {
        const hasIntervalValue =
            typeof data.defaultMaintenanceIntervalValue === 'number';
        const hasIntervalUnit = Boolean(data.defaultMaintenanceIntervalUnit);

        if (hasIntervalValue && !hasIntervalUnit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultMaintenanceIntervalUnit'],
                message: 'Maintenance interval unit is required when a default interval is set',
            });
        }

        if (!hasIntervalValue && hasIntervalUnit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultMaintenanceIntervalValue'],
                message: 'Maintenance interval value is required when a default unit is set',
            });
        }
}

export const CreateCategorySchema = CategorySchemaBase.superRefine(
    refineMaintenanceDefaults
);

/**
 * Schema for updating an existing category
 */
export const UpdateCategorySchema = CategorySchemaBase.partial()
    .extend({
        isActive: z.boolean().optional(),
    })
    .superRefine(refineMaintenanceDefaults);

// ============================================
// Type Exports
// ============================================

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
