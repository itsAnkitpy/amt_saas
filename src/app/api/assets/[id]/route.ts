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

    const asset = await db.asset.findUnique({
        where: { id },
        include: {
            category: true,
            assignedTo: true,
        },
    });

    if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check access - must be same tenant or superadmin
    if (!user.isSuperAdmin && asset.tenantId !== user.tenantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(asset);
}
