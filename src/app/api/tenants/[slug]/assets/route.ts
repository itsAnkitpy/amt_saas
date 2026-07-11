/**
 * Tenant Assets List API
 *
 * GET - Paginated, searchable asset list for the tenant (mobile assets tab)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { parsePagination } from '@/lib/pagination';
import { AssetStatus, Prisma } from '@/generated/prisma';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

const VALID_STATUSES = Object.values(AssetStatus);

/**
 * GET /api/tenants/{slug}/assets
 * Returns paginated active (non-archived) assets, name-sorted.
 *
 * Query params:
 * - q: search term, case-insensitive contains on name / serialNumber / assetTag (optional)
 * - status: filter by asset status (optional)
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 25, max: 100)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if (!authResult.ok) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;
        const { searchParams } = new URL(request.url);

        const { page, pageSize } = parsePagination(searchParams);
        const query = searchParams.get('q')?.trim();
        const statusFilter = searchParams.get('status');

        const where: Prisma.AssetWhereInput = {
            tenantId: tenant.id,
            archivedAt: null,
        };
        if (statusFilter && VALID_STATUSES.includes(statusFilter as AssetStatus)) {
            where.status = statusFilter as AssetStatus;
        }
        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { serialNumber: { contains: query, mode: 'insensitive' } },
                { assetTag: { contains: query, mode: 'insensitive' } },
            ];
        }

        const [assets, total] = await Promise.all([
            db.asset.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    assetTag: true,
                    status: true,
                },
                orderBy: { name: 'asc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            db.asset.count({ where }),
        ]);

        return NextResponse.json({
            assets,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Tenant assets fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assets' },
            { status: 500 }
        );
    }
}
