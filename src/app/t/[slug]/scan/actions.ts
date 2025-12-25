'use server';

import { db } from '@/lib/db';
import { requireTenantAccess } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Quick assign asset from scan page
 */
export async function quickAssignAsset(
    tenantSlug: string,
    assetId: string,
    userId: string
) {
    const { tenant } = await requireTenantAccess(tenantSlug);

    // Verify asset belongs to tenant
    const asset = await db.asset.findFirst({
        where: { id: assetId, tenantId: tenant.id },
    });

    if (!asset) {
        return { error: 'Asset not found' };
    }

    if (asset.status !== 'AVAILABLE') {
        return { error: 'Asset is not available for assignment' };
    }

    // Create assignment record
    await db.assetAssignment.create({
        data: {
            assetId,
            userId,
            notes: 'Assigned via scan',
        },
    });

    // Update asset status
    await db.asset.update({
        where: { id: assetId },
        data: {
            status: 'ASSIGNED',
            assignedToId: userId,
        },
    });

    revalidatePath(`/t/${tenantSlug}/scan`);
    revalidatePath(`/t/${tenantSlug}/assets`);

    return { success: true };
}

/**
 * Quick unassign/return asset from scan page
 */
export async function quickUnassignAsset(
    tenantSlug: string,
    assetId: string
) {
    const { tenant } = await requireTenantAccess(tenantSlug);

    // Verify asset belongs to tenant
    const asset = await db.asset.findFirst({
        where: { id: assetId, tenantId: tenant.id },
    });

    if (!asset) {
        return { error: 'Asset not found' };
    }

    if (asset.status !== 'ASSIGNED') {
        return { error: 'Asset is not currently assigned' };
    }

    // Find current assignment and close it
    const currentAssignment = await db.assetAssignment.findFirst({
        where: { assetId, returnedAt: null },
        orderBy: { assignedAt: 'desc' },
    });

    if (currentAssignment) {
        await db.assetAssignment.update({
            where: { id: currentAssignment.id },
            data: {
                returnedAt: new Date(),
                notes: currentAssignment.notes
                    ? `${currentAssignment.notes} | Returned via scan`
                    : 'Returned via scan'
            },
        });
    }

    // Update asset status
    await db.asset.update({
        where: { id: assetId },
        data: {
            status: 'AVAILABLE',
            assignedToId: null,
        },
    });

    revalidatePath(`/t/${tenantSlug}/scan`);
    revalidatePath(`/t/${tenantSlug}/assets`);

    return { success: true };
}
