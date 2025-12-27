/**
 * Import Execute API
 * 
 * POST - Create assets from validated CSV data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { logBulkAssetActivity, getUserDisplayName } from '@/lib/activity-log';
import { Prisma } from '@/generated/prisma';

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

interface ImportRow {
    name: string;
    serialNumber?: string;
    assetTag?: string;
    status?: string;
    condition?: string;
    location?: string;
    purchasePrice?: string;
    purchaseDate?: string;
    warrantyEnd?: string;
    notes?: string;
    [key: string]: string | undefined; // Custom fields by label
}

const MAX_ROWS = 1000;

/**
 * POST /api/tenants/[slug]/assets/import/execute
 * Create assets from validated import data
 * 
 * Body: JSON with:
 * - categoryId: category ID
 * - rows: array of validated row data (using field labels)
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
        const body = await request.json();
        const { categoryId, rows } = body as { categoryId: string; rows: ImportRow[] };

        if (!categoryId) {
            return NextResponse.json(
                { error: 'categoryId is required' },
                { status: 400 }
            );
        }

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json(
                { error: 'rows array is required and must not be empty' },
                { status: 400 }
            );
        }

        if (rows.length > MAX_ROWS) {
            return NextResponse.json(
                { error: `Maximum ${MAX_ROWS} rows allowed per import` },
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

        const fieldSchema = (category.fieldSchema as unknown as FieldDefinition[]) || [];

        // Build label-to-key map for custom fields
        const labelToKeyMap = new Map(fieldSchema.map(f => [f.label, f.key]));

        // Transform rows to asset data
        const assetsData = rows.map(row => ({
            tenantId: tenant.id,
            categoryId,
            name: row.name.trim(),
            serialNumber: row.serialNumber?.trim() || null,
            assetTag: row.assetTag?.trim() || null,
            status: (row.status?.toUpperCase() || 'AVAILABLE') as 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED',
            condition: (row.condition?.toUpperCase() || 'GOOD') as 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR',
            location: row.location?.trim() || null,
            purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
            purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
            warrantyEnd: row.warrantyEnd ? new Date(row.warrantyEnd) : null,
            notes: row.notes?.trim() || null,
            customFields: extractCustomFields(row, fieldSchema, labelToKeyMap),
        }));

        // Batch create assets in a transaction for atomicity (Issue 2)
        const result = await db.$transaction(async (tx) => {
            return await tx.asset.createMany({
                data: assetsData,
                skipDuplicates: false,
            });
        });

        // Get created asset IDs for activity logging (query by unique fields)
        const createdAssets = await db.asset.findMany({
            where: {
                tenantId: tenant.id,
                categoryId,
                name: { in: rows.map(r => r.name.trim()) }
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: result.count,
        });

        // Log activity for imported assets
        if (createdAssets.length > 0) {
            await logBulkAssetActivity(
                'CREATED',
                createdAssets.map(a => a.id),
                user.id,
                getUserDisplayName(user),
                tenant.id,
                { category: category.name, source: 'bulk_import' }
            );
        }

        return NextResponse.json({
            success: true,
            created: result.count,
            categoryName: category.name
        });

    } catch (error) {
        console.error('Import execute error:', error);
        return NextResponse.json(
            { error: 'Failed to import assets' },
            { status: 500 }
        );
    }
}

/**
 * Extract custom fields from row data, converting labels to field keys
 */
function extractCustomFields(
    row: ImportRow,
    fieldSchema: FieldDefinition[],
    labelToKeyMap: Map<string, string>
): Prisma.InputJsonValue {
    const customFields: Record<string, string | number> = {};

    for (const field of fieldSchema) {
        const value = row[field.label];

        if (value !== undefined && value !== '') {
            const key = labelToKeyMap.get(field.label) || field.key;

            // Type conversion
            if (field.type === 'number') {
                customFields[key] = Number(value);
            } else {
                customFields[key] = value;
            }
        }
    }

    return customFields;
}
