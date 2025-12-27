/**
 * Import Validation API
 * 
 * POST - Validate uploaded CSV before import
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { parseCSV } from '@/lib/csv-utils';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

interface FieldDefinition {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
}

interface ValidatedRow {
    rowNumber: number;
    data: Record<string, string>;
}

interface InvalidRow {
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
}

const VALID_STATUSES = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'];
const VALID_CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
const MAX_ROWS = 1000;

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

        const { tenant } = authResult;
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

        // Build label-to-key map for custom fields
        const labelToKeyMap = new Map(fieldSchema.map(f => [f.label, f.key]));

        const validRows: ValidatedRow[] = [];
        const invalidRows: InvalidRow[] = [];

        // Validate each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2; // Account for header + 1-based

            const { valid, errors } = validateRow(row, fieldSchema, labelToKeyMap);

            if (valid) {
                validRows.push({ rowNumber, data: row });
            } else {
                invalidRows.push({ rowNumber, data: row, errors });
            }
        }

        return NextResponse.json({
            totalRows: rows.length,
            validCount: validRows.length,
            invalidCount: invalidRows.length,
            validRows,
            invalidRows: invalidRows.slice(0, 50), // Limit preview
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
    fieldSchema: FieldDefinition[],
    labelToKeyMap: Map<string, string>
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
