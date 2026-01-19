import { z } from 'zod';

/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup.
 * If any required variable is missing or invalid, the app will fail fast.
 */
const EnvSchema = z.object({
    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

    // Clerk Authentication
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required'),

    // Storage (optional - falls back to local storage)
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    // Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Parse environment variables - fails fast if invalid
const parseResult = EnvSchema.safeParse(process.env);

if (!parseResult.success) {
    console.error('❌ Invalid environment variables:');
    parseResult.error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Invalid environment configuration');
}

/**
 * Type-safe environment variables
 * 
 * Usage:
 * import { env } from '@/lib/env';
 * console.log(env.DATABASE_URL);
 */
export const env = parseResult.data;

// Type export
export type Env = z.infer<typeof EnvSchema>;
