/**
 * Import Template API
 * 
 * GET - Generate category-specific CSV template for bulk import
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { escapeCSV } from '@/lib/csv-utils';

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

/**
 * GET /api/tenants/[slug]/assets/import/template
 * Generate CSV template for a specific category
 * 
 * Query params:
 * - categoryId: required, the category to generate template for
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('categoryId');

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

        // Standard columns (* indicates required)
        const headers = [
            'name*',
            'serialNumber',
            'assetTag',
            'status',        // AVAILABLE, MAINTENANCE, RETIRED
            'condition',     // EXCELLENT, GOOD, FAIR, POOR
            'location',
            'purchasePrice',
            'purchaseDate',  // YYYY-MM-DD
            'warrantyEnd',   // YYYY-MM-DD
            'notes'
        ];

        // Add custom field columns from category schema (using labels)
        const fieldSchema = (category.fieldSchema as unknown as FieldDefinition[]) || [];
        for (const field of fieldSchema) {
            const suffix = field.required ? '*' : '';
            headers.push(`${field.label}${suffix}`);
        }

        // Example row for guidance
        const exampleRow = [
            'Example Asset',
            'SN-12345',
            'AST-001',
            'AVAILABLE',
            'GOOD',
            'Building A, Room 101',
            '999.99',
            '2024-01-15',
            '2026-01-15',
            'Optional notes here'
        ];

        // Add example values for custom fields
        for (const field of fieldSchema) {
            if (field.type === 'select' && field.options?.length) {
                exampleRow.push(field.options[0]);
            } else if (field.type === 'date') {
                exampleRow.push('2024-01-15');
            } else if (field.type === 'number') {
                exampleRow.push('100');
            } else {
                exampleRow.push('Example value');
            }
        }

        // Build CSV content
        const csvContent = [
            headers.map(escapeCSV).join(','),
            exampleRow.map(escapeCSV).join(',')
        ].join('\n');

        // Sanitize category name for filename
        const safeName = category.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filename = `${safeName}-import-template.csv`;

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Template generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate template' },
            { status: 500 }
        );
    }
}
