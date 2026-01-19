import { z } from 'zod';

// ============================================
// Common ID Types
// ============================================

/**
 * CUID validation - Prisma's default ID format
 */
export const CuidSchema = z.string().cuid();

/**
 * Slug validation - URL-safe identifier
 * Allows lowercase letters, numbers, and hyphens
 */
export const SlugSchema = z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be 50 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

// ============================================
// Pagination & Search
// ============================================

/**
 * Pagination parameters for list endpoints
 */
export const PaginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Search and sort parameters
 */
export const SearchSchema = z.object({
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Combined pagination and search
 */
export const ListQuerySchema = PaginationSchema.merge(SearchSchema);

// ============================================
// Type Exports
// ============================================

export type Pagination = z.infer<typeof PaginationSchema>;
export type SearchParams = z.infer<typeof SearchSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
