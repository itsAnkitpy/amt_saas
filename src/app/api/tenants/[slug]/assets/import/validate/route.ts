/**
 * Import Validation API
 * 
 * POST - Validate uploaded CSV before import
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi, requireRole } from '@/lib/auth';
import {
    buildImportIssueRows,
    filterRowsWithoutErrors,
    findDuplicateIdentifierErrors,
    findExistingIdentifierErrors,
    serializeImportableRows,
    toImportRowContexts,
} from '@/lib/asset-import';
import { parseCSV } from '@/lib/csv-utils';
import type { FieldDefinition } from '@/lib/validations';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

const VALID_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'RETIRED'];
const VALID_CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
const MAX_ROWS = 1000;
const PREVIEW_LIMIT = 20;

/**
 * POST /api/tenants/[slug]/assets/import/validate
 * Validate uploaded CSV file
 * 
 * Body: FormData with:
 * - file: CSV file
 * - categoryId: category ID
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { user, tenant } = authResult;
        const roleError = requireRole(user, 'MANAGER');
        if (roleError) {
            return NextResponse.json(
                { error: roleError.error },
                { status: roleError.status }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const categoryId = formData.get('categoryId') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        if (!categoryId) {
            return NextResponse.json(
                { error: 'categoryId is required' },
                { status: 400 }
            );
        }

        // Fetch category with field schema
        const category = await db.assetCategory.findFirst({
            where: { id: categoryId, tenantId: tenant.id }
        });

        if (!category) {
            return NextResponse.json(
                { error: 'Category not found' },
                { status: 404 }
            );
        }

        // Parse CSV
        const csvText = await file.text();
        const rows = parseCSV(csvText);

        if (rows.length === 0) {
            return NextResponse.json(
                { error: 'CSV file is empty or invalid' },
                { status: 400 }
            );
        }

        if (rows.length > MAX_ROWS) {
            return NextResponse.json(
                { error: `Maximum ${MAX_ROWS} rows allowed per import` },
                { status: 400 }
            );
        }

        const fieldSchema = (category.fieldSchema as unknown as FieldDefinition[]) || [];
        const rowContexts = toImportRowContexts(rows);
        const validationErrorMap = new Map<number, string[]>();

        for (const row of rowContexts) {
            const { valid, errors } = validateRow(
                row.data as Record<string, string>,
                fieldSchema
            );

            if (!valid) {
                validationErrorMap.set(row.rowNumber, errors);
            }
        }

        const validationSafeRows = filterRowsWithoutErrors(
            rowContexts,
            validationErrorMap
        );
        const fileDuplicateErrorMap = findDuplicateIdentifierErrors(
            validationSafeRows
        );
        const duplicateSafeRows = filterRowsWithoutErrors(
            validationSafeRows,
            fileDuplicateErrorMap
        );
        const existingConflictErrorMap = await findExistingIdentifierErrors(
            db,
            tenant.id,
            duplicateSafeRows
        );
        const importableRows = filterRowsWithoutErrors(
            duplicateSafeRows,
            existingConflictErrorMap
        );

        return NextResponse.json({
            totalRows: rows.length,
            importableCount: importableRows.length,
            blockedCount: rows.length - importableRows.length,
            summary: {
                validationErrors: validationErrorMap.size,
                fileDuplicates: fileDuplicateErrorMap.size,
                existingConflicts: existingConflictErrorMap.size,
            },
            importableRows: serializeImportableRows(importableRows),
            blockedPreview: {
                validationErrors: buildImportIssueRows(
                    rowContexts,
                    validationErrorMap
                ).slice(0, PREVIEW_LIMIT),
                fileDuplicates: buildImportIssueRows(
                    validationSafeRows,
                    fileDuplicateErrorMap
                ).slice(0, PREVIEW_LIMIT),
                existingConflicts: buildImportIssueRows(
                    duplicateSafeRows,
                    existingConflictErrorMap
                ).slice(0, PREVIEW_LIMIT),
            },
            categoryId,
            categoryName: category.name
        });

    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json(
            { error: 'Failed to validate file' },
            { status: 500 }
        );
    }
}

/**
 * Validate a single row against schema
 */
function validateRow(
    row: Record<string, string>,
    fieldSchema: FieldDefinition[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required: name
    if (!row.name || !row.name.trim()) {
        errors.push('Name is required');
    }

    // Enum: status (optional, defaults to AVAILABLE)
    if (row.status && !VALID_STATUSES.includes(row.status.toUpperCase())) {
        errors.push(`Invalid status: ${row.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Enum: condition (optional, defaults to GOOD)
    if (row.condition && !VALID_CONDITIONS.includes(row.condition.toUpperCase())) {
        errors.push(`Invalid condition: ${row.condition}. Must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }

    // Numeric: purchasePrice
    if (row.purchasePrice && isNaN(Number(row.purchasePrice))) {
        errors.push('Purchase price must be a number');
    }

    // Date: purchaseDate
    if (row.purchaseDate && isNaN(Date.parse(row.purchaseDate))) {
        errors.push('Purchase date must be a valid date (YYYY-MM-DD)');
    }

    // Date: warrantyEnd
    if (row.warrantyEnd && isNaN(Date.parse(row.warrantyEnd))) {
        errors.push('Warranty end must be a valid date (YYYY-MM-DD)');
    }

    // Custom fields validation (by label)
    for (const field of fieldSchema) {
        const value = row[field.label];

        // Required check
        if (field.required && (!value || !value.trim())) {
            errors.push(`${field.label} is required`);
            continue;
        }

        if (value && value.trim()) {
            // Type validation
            if (field.type === 'number' && isNaN(Number(value))) {
                errors.push(`${field.label} must be a number`);
            }
            if (field.type === 'date' && isNaN(Date.parse(value))) {
                errors.push(`${field.label} must be a valid date (YYYY-MM-DD)`);
            }
            if (field.type === 'select' && field.options && !field.options.includes(value)) {
                errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}
