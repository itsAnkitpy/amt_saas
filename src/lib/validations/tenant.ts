import { z } from 'zod';
import { SlugSchema } from './common';

// ============================================
// Enums (matching Prisma schema)
// ============================================

export const PlanSchema = z.enum([
    'FREE',
    'STARTER',
    'PROFESSIONAL',
    'ENTERPRISE',
]);

// ============================================
// Tenant Schemas
// ============================================

/**
 * Schema for creating a new tenant
 */
export const CreateTenantSchema = z.object({
    name: z
        .string()
        .min(1, 'Tenant name is required')
        .max(100, 'Name must be 100 characters or less'),
    slug: SlugSchema,
    plan: PlanSchema.default('FREE'),
});

/**
 * Schema for updating an existing tenant
 */
export const UpdateTenantSchema = CreateTenantSchema.partial();

// ============================================
// Type Exports
// ============================================

export type Plan = z.infer<typeof PlanSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
