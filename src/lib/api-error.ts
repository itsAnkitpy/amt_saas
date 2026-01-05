/**
 * API Error Handling Utilities
 * 
 * Provides consistent error responses across all API routes.
 * 
 * Usage:
 *   import { handleApiError, badRequest, forbidden, notFound } from '@/lib/api-error';
 *   
 *   // In route:
 *   if (!data) throw notFound('Asset not found');
 *   
 *   // In catch block:
 *   catch (error) { return handleApiError(error); }
 */

import { NextResponse } from 'next/server';

/**
 * Custom API Error with status code and optional error code
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Error factory functions
export const badRequest = (message: string) => new ApiError(message, 400, 'BAD_REQUEST');
export const unauthorized = (message: string = 'Unauthorized') => new ApiError(message, 401, 'UNAUTHORIZED');
export const forbidden = (message: string) => new ApiError(message, 403, 'FORBIDDEN');
export const notFound = (message: string) => new ApiError(message, 404, 'NOT_FOUND');
export const conflict = (message: string) => new ApiError(message, 409, 'CONFLICT');
export const serverError = (message: string = 'An unexpected error occurred') => new ApiError(message, 500, 'INTERNAL_ERROR');

/**
 * Centralized error handler for API routes
 * 
 * Handles:
 * - ApiError instances (known errors)
 * - Prisma errors (database errors)
 * - Unknown errors (generic 500)
 */
export function handleApiError(error: unknown): NextResponse {
    // Log all errors for debugging
    console.error('[API Error]', error);

    // Handle known API errors
    if (error instanceof ApiError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
        );
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as { code: string; message?: string };

        switch (prismaError.code) {
            case 'P2025': // Record not found
                return NextResponse.json(
                    { error: 'Record not found', code: 'NOT_FOUND' },
                    { status: 404 }
                );
            case 'P2002': // Unique constraint violation
                return NextResponse.json(
                    { error: 'A record with this value already exists', code: 'CONFLICT' },
                    { status: 409 }
                );
            case 'P2003': // Foreign key constraint failed
                return NextResponse.json(
                    { error: 'Related record not found', code: 'BAD_REQUEST' },
                    { status: 400 }
                );
        }
    }

    // Handle standard Error objects
    if (error instanceof Error) {
        // In development, show actual error; in production, hide details
        const message = process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred';

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }

    // Unknown error type
    return NextResponse.json(
        { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
        { status: 500 }
    );
}
