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
    CLERK_WEBHOOK_SECRET: z.string().optional(),

    // Storage (optional - falls back to local storage).
    // BLOB_STORE_ID is injected by Vercel when a Blob store is connected to the
    // project, and is what selects the blob provider (see lib/storage/index.ts).
    // BLOB_READ_WRITE_TOKEN is only needed to reach the store from outside Vercel;
    // on Vercel the SDK authenticates with a short-lived OIDC token instead.
    BLOB_STORE_ID: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    // Cron — used by /api/cron/notifications/daily bearer auth.
    // Vercel Cron injects this same value as `Authorization: Bearer <secret>`.
    CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 chars'),

    // Mail transport (Module 10 M3).
    // `mailpit` for local SMTP via nodemailer; `resend` for staging/prod via Resend SDK.
    MAIL_TRANSPORT: z.enum(['mailpit', 'resend']),
    MAIL_FROM: z.string().email('MAIL_FROM must be a valid email'),

    // Mailpit — required only when MAIL_TRANSPORT=mailpit (enforced below).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),

    // Resend — required only when MAIL_TRANSPORT=resend (enforced below).
    RESEND_API_KEY: z.string().optional(),

    // Staging safety: when set, every outbound recipient list collapses to this address.
    EMAIL_OVERRIDE_TO: z.string().email().optional(),

    // Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === 'mailpit') {
        if (!env.SMTP_HOST) {
            ctx.addIssue({
                code: 'custom',
                message: 'SMTP_HOST required when MAIL_TRANSPORT=mailpit',
                path: ['SMTP_HOST'],
            });
        }
        if (!env.SMTP_PORT) {
            ctx.addIssue({
                code: 'custom',
                message: 'SMTP_PORT required when MAIL_TRANSPORT=mailpit',
                path: ['SMTP_PORT'],
            });
        }
    }
    if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
        ctx.addIssue({
            code: 'custom',
            message: 'RESEND_API_KEY required when MAIL_TRANSPORT=resend',
            path: ['RESEND_API_KEY'],
        });
    }
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
