/**
 * Single Image Management API
 * 
 * DELETE - Remove an image
 * PATCH  - Update image (set primary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import { logAssetActivity, getUserDisplayName } from '@/lib/activity-log';
import { getStorage } from '@/lib/storage';

interface RouteParams {
    params: Promise<{
        slug: string;
        id: string;
        imageId: string;
    }>;
}

/**
 * DELETE /api/tenants/[slug]/assets/[id]/images/[imageId]
 * Delete an image from an asset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id: assetId, imageId } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;

        // Find image and verify it belongs to this tenant's asset
        const image = await db.assetImage.findFirst({
            where: { id: imageId },
            include: { asset: true }
        });

        if (!image || image.asset.tenantId !== tenant.id || image.assetId !== assetId) {
            return NextResponse.json(
                { error: 'Image not found' },
                { status: 404 }
            );
        }

        // If this was primary, set another image as primary BEFORE deleting
        if (image.isPrimary) {
            const nextImage = await db.assetImage.findFirst({
                where: {
                    assetId,
                    id: { not: imageId }
                },
                orderBy: { sortOrder: 'asc' }
            });

            if (nextImage) {
                await db.assetImage.update({
                    where: { id: nextImage.id },
                    data: { isPrimary: true }
                });
            }
        }

        // Delete database record FIRST (transaction-safe, can be rolled back if it fails)
        await db.assetImage.delete({
            where: { id: imageId }
        });

        // Then delete files from storage
        // Use blob URLs if available (cloud storage), otherwise use file paths (local storage)
        const storage = getStorage();
        const deletePromises = [];

        // Delete original image
        if (image.blobUrl) {
            deletePromises.push(storage.delete(image.blobUrl));
        } else {
            deletePromises.push(storage.delete(image.filePath));
        }

        // Delete thumbnail
        if (image.thumbBlobUrl) {
            deletePromises.push(storage.delete(image.thumbBlobUrl));
        } else if (image.thumbPath) {
            deletePromises.push(storage.delete(image.thumbPath));
        }

        await Promise.allSettled(deletePromises);

        // Log activity
        await logAssetActivity({
            action: 'IMAGE_REMOVED',
            assetId,
            userId: authResult.user.id,
            userName: getUserDisplayName(authResult.user),
            tenantId: tenant.id,
            details: { fileName: image.fileName }
        });

        return NextResponse.json({
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting image:', error);
        return NextResponse.json(
            { error: 'Failed to delete image' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/tenants/[slug]/assets/[id]/images/[imageId]
 * Update image (set as primary)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id: assetId, imageId } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;

        // Parse body
        const body = await request.json();
        const { isPrimary } = body;

        // Find image and verify ownership
        const image = await db.assetImage.findFirst({
            where: { id: imageId },
            include: { asset: true }
        });

        if (!image || image.asset.tenantId !== tenant.id || image.assetId !== assetId) {
            return NextResponse.json(
                { error: 'Image not found' },
                { status: 404 }
            );
        }

        // If setting as primary, unset current primary
        if (isPrimary === true) {
            await db.assetImage.updateMany({
                where: { assetId, isPrimary: true },
                data: { isPrimary: false }
            });
        }

        // Update the image
        const updated = await db.assetImage.update({
            where: { id: imageId },
            data: { isPrimary: isPrimary ?? image.isPrimary }
        });

        return NextResponse.json({ image: updated });

    } catch (error) {
        console.error('Error updating image:', error);
        return NextResponse.json(
            { error: 'Failed to update image' },
            { status: 500 }
        );
    }
}
