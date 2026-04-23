import { redirect } from "next/navigation";
import type { FieldDefinition } from "@/components/dynamic-form";
import { hasRole, requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewAssetForm } from "./new-asset-form";

interface NewAssetPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ serial?: string }>;
}

/**
 * Create New Asset Page
 */
export default async function NewAssetPage({
    params,
    searchParams,
}: NewAssetPageProps) {
    const { slug } = await params;
    const { serial } = await searchParams;
    const { tenant, user } = await requireTenantAccess(slug);

    if (!hasRole(user, "MANAGER")) {
        redirect(`/t/${slug}/assets`);
    }

    const categoriesRaw = await db.assetCategory.findMany({
        where: {
            tenantId: tenant.id,
            isActive: true,
        },
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            fieldSchema: true,
            defaultMaintenanceIntervalValue: true,
            defaultMaintenanceIntervalUnit: true,
            defaultMaintenanceInstructions: true,
        },
    });

    const categories = categoriesRaw.map((category) => ({
        id: category.id,
        name: category.name,
        fieldSchema: category.fieldSchema as unknown as FieldDefinition[],
        defaultMaintenanceIntervalValue:
            category.defaultMaintenanceIntervalValue,
        defaultMaintenanceIntervalUnit: category.defaultMaintenanceIntervalUnit,
        defaultMaintenanceInstructions:
            category.defaultMaintenanceInstructions,
    }));

    return (
        <NewAssetForm
            slug={slug}
            categories={categories}
            prefillSerial={serial ?? ""}
        />
    );
}
