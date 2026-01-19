import { z } from 'zod';

// ============================================
// Enums (matching Prisma schema)
// ============================================

export const RoleSchema = z.enum(['USER', 'MANAGER', 'ADMIN']);

// ============================================
// User Schemas
// ============================================

/**
 * Schema for inviting/creating a new user
 */
export const InviteUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    firstName: z
        .string()
        .min(1, 'First name is required')
        .max(100, 'First name must be 100 characters or less'),
    lastName: z.string().max(100).optional().nullable(),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be 100 characters or less'),
    role: RoleSchema.default('USER'),
});

/**
 * Schema for updating an existing user
 */
export const UpdateUserSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().max(100).optional().nullable(),
    role: RoleSchema.optional(),
});

// ============================================
// Type Exports
// ============================================

export type Role = z.infer<typeof RoleSchema>;
export type InviteUser = z.infer<typeof InviteUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
