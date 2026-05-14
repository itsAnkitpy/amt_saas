/**
 * Import Execute API
 * 
 * POST - Create assets from validated CSV data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi, requireRole } from '@/lib/auth';
import { handleApiError, badRequest } from '@/lib/api-error';
import {
    buildImportIssueRows,
    findDuplicateIdentifierErrors,
    findExistingIdentifierErrors,
    toImportRowContexts,
} from '@/lib/asset-import';
import { normalizeAssetImportRowForCreate } from '@/lib/asset-rules';
import { logBulkAssetActivity, getUserDisplayName } from '@/lib/activity-log';
import { Prisma } from '@/generated/prisma';
import { ImportExecuteSchema, validateBody, type FieldDefinition } from '@/lib/validations';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

const PREVIEW_LIMIT = 20;

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

        if (!authResult.ok) {
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
        const rowContexts = toImportRowContexts(rows as Record<string, unknown>[]);

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

        const fileDuplicateErrorMap = findDuplicateIdentifierErrors(rowContexts);
        if (fileDuplicateErrorMap.size > 0) {
            return NextResponse.json(
                {
                    error: 'Import could not be completed because the uploaded rows contain duplicate serial numbers or asset tags. Revalidate the file and try again.',
                    summary: {
                        validationErrors: 0,
                        fileDuplicates: fileDuplicateErrorMap.size,
                        existingConflicts: 0,
                    },
                    blockedPreview: {
                        validationErrors: [],
                        fileDuplicates: buildImportIssueRows(
                            rowContexts,
                            fileDuplicateErrorMap
                        ).slice(0, PREVIEW_LIMIT),
                        existingConflicts: [],
                    },
                },
                { status: 409 }
            );
        }

        const assetsData: Prisma.AssetCreateManyInput[] = rowContexts.map((rowContext) => {
            let assetData;
            try {
                assetData = normalizeAssetImportRowForCreate({
                    row: rowContext.data,
                    categoryId,
                    fieldSchema,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Invalid asset row';
                throw badRequest(`Row ${rowContext.rowNumber}: ${message}`);
            }

            return {
                tenantId: tenant.id,
                categoryId: assetData.categoryId,
                name: assetData.name,
                serialNumber: assetData.serialNumber ?? null,
                assetTag: assetData.assetTag ?? null,
                status: assetData.status,
                condition: assetData.condition,
                location: assetData.location ?? null,
                purchasePrice: assetData.purchasePrice ?? null,
                purchaseDate: assetData.purchaseDate ?? null,
                warrantyEnd: assetData.warrantyEnd ?? null,
                notes: assetData.notes ?? null,
                customFields: assetData.customFields as Prisma.InputJsonValue,
            };
        });

        try {
            // Batch create assets and log activity in a single transaction
            const result = await db.$transaction(async (tx) => {
                const existingConflictErrorMap = await findExistingIdentifierErrors(
                    tx,
                    tenant.id,
                    rowContexts
                );

                if (existingConflictErrorMap.size > 0) {
                    return {
                        kind: 'conflict' as const,
                        summary: {
                            validationErrors: 0,
                            fileDuplicates: 0,
                            existingConflicts: existingConflictErrorMap.size,
                        },
                        blockedPreview: {
                            validationErrors: [],
                            fileDuplicates: [],
                            existingConflicts: buildImportIssueRows(
                                rowContexts,
                                existingConflictErrorMap
                            ).slice(0, PREVIEW_LIMIT),
                        },
                    };
                }

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

                return {
                    kind: 'success' as const,
                    count: createdAssets.length,
                    categoryName: category.name,
                };
            });

            if (result.kind === 'conflict') {
                return NextResponse.json(
                    {
                        error: 'Import could not be completed because some rows now conflict with existing assets. Please revalidate the file and try again.',
                        summary: result.summary,
                        blockedPreview: result.blockedPreview,
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json({
                success: true,
                created: result.count,
                categoryName: result.categoryName
            });
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                return NextResponse.json(
                    {
                        error: 'Import could not be completed because matching serial numbers or asset tags were created while the import was running. Please revalidate and try again.',
                    },
                    { status: 409 }
                );
            }

            throw error;
        }

    } catch (error) {
        return handleApiError(error);
    }
}
