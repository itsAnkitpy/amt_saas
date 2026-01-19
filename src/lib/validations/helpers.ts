import { z, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Result type for validation
 */
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; issues: z.ZodIssue[] };

/**
 * Validate data against a Zod schema
 * 
 * @example
 * const result = validate(CreateAssetSchema, body);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * // result.data is fully typed
 */
export function validate<T extends ZodSchema>(
    schema: T,
    data: unknown
): ValidationResult<z.infer<T>> {
    const result = schema.safeParse(data);

    if (!result.success) {
        return {
            success: false,
            error: result.error.issues[0]?.message || 'Validation failed',
            issues: result.error.issues,
        };
    }

    return {
        success: true,
        data: result.data,
    };
}

/**
 * Validate request body and return error response if invalid
 * 
 * @example
 * const validated = validateBody(BulkActionSchema, body);
 * if ('error' in validated) return validated.error;
 * const { action, assetIds } = validated.data;
 */
export function validateBody<T extends ZodSchema>(
    schema: T,
    body: unknown
): { data: z.infer<T> } | { error: NextResponse } {
    const result = schema.safeParse(body);

    if (!result.success) {
        return {
            error: NextResponse.json(
                {
                    error: result.error.issues[0]?.message || 'Validation failed',
                    details: result.error.issues,
                },
                { status: 400 }
            ),
        };
    }

    return { data: result.data };
}

/**
 * Validate FormData against a schema
 * Converts FormData to object first
 * 
 * @example
 * const result = validateFormData(CreateCategorySchema, formData);
 */
export function validateFormData<T extends ZodSchema>(
    schema: T,
    formData: FormData
): ValidationResult<z.infer<T>> {
    const data: Record<string, unknown> = {};

    formData.forEach((value, key) => {
        // Try to parse JSON for complex fields
        if (typeof value === 'string') {
            try {
                data[key] = JSON.parse(value);
            } catch {
                data[key] = value;
            }
        } else {
            data[key] = value;
        }
    });

    return validate(schema, data);
}
