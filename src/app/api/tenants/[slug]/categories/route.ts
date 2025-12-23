import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { tenant } = await requireTenantAccess(slug);

        const categories = await db.assetCategory.findMany({
            where: { tenantId: tenant.id, isActive: true },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(categories);
    } catch (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
