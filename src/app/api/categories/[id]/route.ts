import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const category = await db.assetCategory.findUnique({
        where: { id },
        include: {
            _count: {
                select: { assets: true },
            },
        },
    });

    if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check access - must be same tenant or superadmin
    if (!user.isSuperAdmin && category.tenantId !== user.tenantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(category);
}
