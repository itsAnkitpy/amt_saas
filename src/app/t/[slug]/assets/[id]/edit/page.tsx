import { notFound, redirect } from "next/navigation";
import type { FieldDefinition } from "@/components/dynamic-form";
import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditAssetForm } from "./edit-asset-form";

interface EditAssetPageProps {
    params: Promise<{ slug: string; id: string }>;
}

/**
 * Edit Asset Page
 */
export default async function EditAssetPage({ params }: EditAssetPageProps) {
    const { slug, id } = await params;
    const { tenant, user } = await requireTenantAccess(slug);

    if (!hasRole(user, "MANAGER")) {
        redirect(`/t/${slug}/assets`);
    }

    const asset = await db.asset.findFirst({
        where: {
            id,
            tenantId: tenant.id,
        },
        include: {
            category: true,
        },
    });

    if (!asset) {
        notFound();
    }

    return (
        <EditAssetForm
            slug={slug}
            asset={{
                id: asset.id,
                name: asset.name,
                serialNumber: asset.serialNumber,
                assetTag: asset.assetTag,
                categoryId: asset.categoryId,
                customFields: asset.customFields as Record<string, unknown>,
                status: asset.status,
                condition: asset.condition,
                location: asset.location,
                purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
                purchaseDate: asset.purchaseDate?.toISOString() ?? null,
                warrantyEnd: asset.warrantyEnd?.toISOString() ?? null,
                notes: asset.notes,
                category: {
                    id: asset.category.id,
                    name: asset.category.name,
                    fieldSchema: asset.category.fieldSchema as unknown as FieldDefinition[],
                },
            }}
        />
    );
}
