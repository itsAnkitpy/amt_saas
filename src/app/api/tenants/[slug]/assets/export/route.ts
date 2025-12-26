/**
 * Bulk Export API
 * 
 * GET - Export assets to CSV format
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

/**
 * GET /api/tenants/[slug]/assets/export
 * Export assets to CSV
 * 
 * Query params:
 * - ids: comma-separated asset IDs (optional, exports all if not provided)
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

        const { user, tenant } = authResult;
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids');

        // Build where clause
        const where: { tenantId: string; id?: { in: string[] } } = {
            tenantId: tenant.id
        };

        // If specific IDs provided, filter to those
        if (idsParam) {
            const ids = idsParam.split(',').filter(Boolean);
            if (ids.length > 0) {
                where.id = { in: ids };
            }
        }

        // Fetch assets with relations
        const assets = await db.asset.findMany({
            where,
            include: {
                category: true,
                assignedTo: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Define CSV columns
        const columns = [
            'ID',
            'Name',
            'Category',
            'Serial Number',
            'Asset Tag',
            'Status',
            'Condition',
            'Location',
            'Purchase Price',
            'Purchase Date',
            'Warranty End',
            'Assigned To',
            'Notes',
            'Custom Fields',
            'Created At',
        ];

        // Convert assets to CSV rows (all values escaped for consistency)
        const rows = assets.map(asset => {
            // Transform custom field IDs to labels
            let customFieldsFormatted = '';
            if (asset.customFields && typeof asset.customFields === 'object') {
                const fieldSchema = asset.category.fieldSchema as Array<{ key: string; label: string }> | null;
                const fieldMap = new Map(fieldSchema?.map(f => [f.key, f.label]) || []);

                const transformedFields: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(asset.customFields as Record<string, unknown>)) {
                    const label = fieldMap.get(key) || key; // Fallback to key if no label found
                    transformedFields[label] = value;
                }
                customFieldsFormatted = JSON.stringify(transformedFields);
            }

            return [
                escapeCSV(asset.id),
                escapeCSV(asset.name),
                escapeCSV(asset.category.name),
                escapeCSV(asset.serialNumber || ''),
                escapeCSV(asset.assetTag || ''),
                escapeCSV(asset.status),
                escapeCSV(asset.condition || ''),
                escapeCSV(asset.location || ''),
                escapeCSV(asset.purchasePrice ? Number(asset.purchasePrice).toFixed(2) : ''),
                escapeCSV(asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : ''),
                escapeCSV(asset.warrantyEnd ? asset.warrantyEnd.toISOString().split('T')[0] : ''),
                escapeCSV(asset.assignedTo
                    ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName || ''}`.trim()
                    : ''),
                escapeCSV(asset.notes || ''),
                escapeCSV(customFieldsFormatted),
                escapeCSV(asset.createdAt.toISOString()),
            ];
        });

        // Build CSV content
        const csvContent = [
            columns.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Audit log
        console.log(`[AUDIT] Export by user ${user.id} on tenant ${tenant.slug}: ${assets.length} assets exported`);

        // Return as downloadable CSV
        const filename = `assets-export-${new Date().toISOString().split('T')[0]}.csv`;

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Failed to export assets' },
            { status: 500 }
        );
    }
}

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string): string {
    if (!value) return '';

    // If contains comma, newline, or quote, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
