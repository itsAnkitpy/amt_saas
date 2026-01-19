/**
 * Validation Schemas
 * 
 * Central export for all Zod validation schemas.
 * Import from here: import { CreateAssetSchema } from '@/lib/validations';
 */

// Common schemas
export {
    CuidSchema,
    SlugSchema,
    PaginationSchema,
    SearchSchema,
    ListQuerySchema,
    type Pagination,
    type SearchParams,
    type ListQuery,
} from './common';

// Asset schemas
export {
    AssetStatusSchema,
    AssetConditionSchema,
    BulkActionSchema,
    CreateAssetSchema,
    UpdateAssetSchema,
    ImportRowSchema,
    ImportExecuteSchema,
    type AssetStatus,
    type AssetCondition,
    type BulkAction,
    type CreateAsset,
    type UpdateAsset,
    type ImportRow,
    type ImportExecute,
} from './asset';

// User schemas
export {
    RoleSchema,
    InviteUserSchema,
    UpdateUserSchema,
    type Role,
    type InviteUser,
    type UpdateUser,
} from './user';

// Tenant schemas
export {
    PlanSchema,
    CreateTenantSchema,
    UpdateTenantSchema,
    type Plan,
    type CreateTenant,
    type UpdateTenant,
} from './tenant';

// Category schemas
export {
    CreateCategorySchema,
    UpdateCategorySchema,
    type FieldType,
    type FieldDefinition,
    type CreateCategory,
    type UpdateCategory,
} from './category';

// Helper functions
export {
    validate,
    validateBody,
    validateFormData,
    type ValidationResult,
} from './helpers';
