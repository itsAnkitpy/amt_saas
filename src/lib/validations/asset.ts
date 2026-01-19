import { z } from 'zod';
import { CuidSchema } from './common';

// ============================================
// Enums (matching Prisma schema)
// ============================================

export const AssetStatusSchema = z.enum([
    'AVAILABLE',
    'ASSIGNED',
    'MAINTENANCE',
    'RETIRED',
]);

export const AssetConditionSchema = z.enum([
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
]);

// ============================================
// Bulk Actions
// ============================================

/**
 * Schema for bulk asset operations
 */
export const BulkActionSchema = z.object({
    action: z.enum(['update_status', 'assign', 'unassign', 'delete']),
    assetIds: z
        .array(CuidSchema)
        .min(1, 'At least one asset must be selected')
        .max(1000, 'Cannot process more than 1000 assets at once'),
    data: z
        .object({
            status: AssetStatusSchema.optional(),
            assignedToId: CuidSchema.optional(),
        })
        .optional(),
});

// ============================================
// Create / Update Asset
// ============================================

/**
 * Schema for creating a new asset
 */
export const CreateAssetSchema = z.object({
    name: z
        .string()
        .min(1, 'Asset name is required')
        .max(255, 'Name must be 255 characters or less'),
    categoryId: CuidSchema,
    serialNumber: z.string().max(100).optional().nullable(),
    assetTag: z.string().max(50).optional().nullable(),
    status: AssetStatusSchema.default('AVAILABLE'),
    condition: AssetConditionSchema.default('GOOD'),
    location: z.string().max(255).optional().nullable(),
    purchasePrice: z.coerce.number().positive().optional().nullable(),
    purchaseDate: z.coerce.date().optional().nullable(),
    warrantyEnd: z.coerce.date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Schema for updating an existing asset (all fields optional)
 */
export const UpdateAssetSchema = CreateAssetSchema.partial();

// ============================================
// Import Operations
// ============================================

/**
 * Single row from CSV import
 * Uses passthrough to allow custom fields
 */
export const ImportRowSchema = z
    .object({
        name: z.string().min(1, 'Name is required'),
        serialNumber: z.string().optional(),
        assetTag: z.string().optional(),
        status: z.string().optional(),
        condition: z.string().optional(),
        location: z.string().optional(),
        purchasePrice: z.string().optional(),
        purchaseDate: z.string().optional(),
        warrantyEnd: z.string().optional(),
        notes: z.string().optional(),
    })
    .passthrough(); // Allow custom fields

/**
 * Schema for import execute request
 */
export const ImportExecuteSchema = z.object({
    categoryId: CuidSchema,
    rows: z
        .array(ImportRowSchema)
        .min(1, 'At least one row is required')
        .max(1000, 'Cannot import more than 1000 assets at once'),
});

// ============================================
// Type Exports
// ============================================

export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type AssetCondition = z.infer<typeof AssetConditionSchema>;
export type BulkAction = z.infer<typeof BulkActionSchema>;
export type CreateAsset = z.infer<typeof CreateAssetSchema>;
export type UpdateAsset = z.infer<typeof UpdateAssetSchema>;
export type ImportRow = z.infer<typeof ImportRowSchema>;
export type ImportExecute = z.infer<typeof ImportExecuteSchema>;
