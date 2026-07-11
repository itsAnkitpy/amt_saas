/**
 * Tenant Stats API
 *
 * GET - Asset counts by status for the tenant (mobile dashboard)
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        slug: string;
    }>;
}

/**
 * GET /api/tenants/{slug}/stats
 * Returns active (non-archived) asset counts, total and per status.
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

        const grouped = await db.asset.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id, archivedAt: null },
            _count: { status: true },
        });

        const byStatus = Object.fromEntries(
            grouped.map((item) => [item.status, item._count.status])
        );

        const stats = {
            available: byStatus.AVAILABLE ?? 0,
            assigned: byStatus.ASSIGNED ?? 0,
            maintenance: byStatus.MAINTENANCE ?? 0,
            retired: byStatus.RETIRED ?? 0,
        };

        return NextResponse.json({
            total: stats.available + stats.assigned + stats.maintenance + stats.retired,
            ...stats,
        });
    } catch (error) {
        console.error('Tenant stats fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
