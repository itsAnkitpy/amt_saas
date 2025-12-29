/**
 * Image Serving API
 * 
 * GET - Serve image file with tenant access validation
 * 
 * This endpoint serves images privately, validating that the
 * requesting user has access to the tenant that owns the image.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';

interface RouteParams {
    params: Promise<{
        imageId: string;
    }>;
}

/**
 * GET /api/images/[imageId]
 * Serve the original image
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { imageId } = await params;

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Find image with asset and tenant info
        const image = await db.assetImage.findUnique({
            where: { id: imageId },
            include: {
                asset: {
                    select: { tenantId: true }
                }
            }
        });

        if (!image) {
            return NextResponse.json(
                { error: 'Image not found' },
                { status: 404 }
            );
        }

        // Check tenant access (superadmin can access any, regular user only their tenant)
        if (!user.isSuperAdmin && user.tenantId !== image.asset.tenantId) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // If blob URL exists, redirect to CDN for faster delivery
        if (image.blobUrl) {
            return NextResponse.redirect(image.blobUrl);
        }

        // Get file from local storage
        const storage = getStorage();
        const buffer = await storage.getBuffer(image.filePath);

        if (!buffer) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Return image with appropriate headers
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': image.mimeType,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
            }
        });

    } catch (error) {
        console.error('Error serving image:', error);
        return NextResponse.json(
            { error: 'Failed to serve image' },
            { status: 500 }
        );
    }
}
