/**
 * Import Execute API
 * 
 * POST - Create assets from validated CSV data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi, requireRole } from '@/lib/auth';
import { handleApiError, badRequest } from '@/lib/api-error';
import { logBulkAssetActivity, getUserDisplayName } from '@/lib/activity-log';
import { validateAndNormalizeCustomFields } from '@/lib/asset-service';
import { Prisma } from '@/generated/prisma';
import { ImportExecuteSchema, validateBody, type ImportRow, type FieldDefinition } from '@/lib/validations';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

// FieldDefinition is imported from '@/lib/validations'

const IMPORTABLE_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as const;

/**
 * POST /api/tenants/[slug]/assets/import/execute
 * Create assets from validated import data
 * Requires: MANAGER role or higher
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

        // RBAC: Require MANAGER role for bulk import
        const roleError = requireRole(user, 'MANAGER');
        if (roleError) {
            return NextResponse.json(
                { error: roleError.error },
                { status: roleError.status }
            );
        }

        const body = await request.json();

        // Validate with Zod schema
        const validated = validateBody(ImportExecuteSchema, body);
        if ('error' in validated) return validated.error;

        const { categoryId, rows } = validated.data;

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

        const invalidAssignedRow = rows.find((row) => {
            const normalizedStatus = row.status?.trim().toUpperCase();
            return normalizedStatus === 'ASSIGNED';
        });

        if (invalidAssignedRow) {
            return NextResponse.json(
                {
                    error: 'Bulk import cannot create assigned assets. Import them as AVAILABLE and use assign afterward.',
                },
                { status: 400 }
            );
        }

        const invalidStatusRow = rows.find((row) => {
            const normalizedStatus = row.status?.trim().toUpperCase();
            return normalizedStatus && !IMPORTABLE_STATUSES.includes(normalizedStatus as typeof IMPORTABLE_STATUSES[number]);
        });

        if (invalidStatusRow) {
            return NextResponse.json(
                {
                    error: `Invalid status in import rows. Allowed values: ${IMPORTABLE_STATUSES.join(', ')}.`,
                },
                { status: 400 }
            );
        }

        // Build label-to-key map for custom fields
        const labelToKeyMap = new Map(fieldSchema.map(f => [f.label, f.key]));

        // Transform rows to asset data, validating custom fields against category schema
        const assetsData = rows.map((row, index) => {
            const rawCustomFields = extractCustomFields(row, fieldSchema, labelToKeyMap);

            // Validate and normalize custom fields using the same logic as asset create/update
            let normalizedCustomFields: Prisma.InputJsonValue;
            try {
                normalizedCustomFields = validateAndNormalizeCustomFields(
                    rawCustomFields as Record<string, unknown>,
                    fieldSchema
                ) as Prisma.InputJsonValue;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Invalid custom fields';
                throw badRequest(`Row ${index + 1}: ${message}`);
            }

            return {
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
                customFields: normalizedCustomFields,
            };
        });

        // Batch create assets and log activity in a single transaction
        const result = await db.$transaction(async (tx) => {
            const createdAssets = await tx.asset.createManyAndReturn({
                data: assetsData,
                select: { id: true },
            });

            // Log activity atomically with the creation
            if (createdAssets.length > 0) {
                await logBulkAssetActivity(
                    'CREATED',
                    createdAssets.map(a => a.id),
                    user.id,
                    getUserDisplayName(user),
                    tenant.id,
                    { category: category.name, source: 'bulk_import' },
                    tx
                );
            }

            return { count: createdAssets.length, categoryName: category.name };
        });

        return NextResponse.json({
            success: true,
            created: result.count,
            categoryName: result.categoryName
        });

    } catch (error) {
        return handleApiError(error);
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
        // Cast row to Record to access by label (Zod passthrough allows any keys)
        const rowRecord = row as Record<string, unknown>;
        const value = rowRecord[field.label];

        if (value !== undefined && value !== null && value !== '') {
            const key = labelToKeyMap.get(field.label) || field.key;

            // Type conversion
            if (field.type === 'number' && typeof value === 'string') {
                customFields[key] = Number(value);
            } else if (typeof value === 'string' || typeof value === 'number') {
                customFields[key] = value;
            }
        }
    }

    return customFields;
}
