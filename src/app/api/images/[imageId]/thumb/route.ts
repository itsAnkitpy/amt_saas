/**
 * Thumbnail Serving API
 * 
 * GET - Serve thumbnail image with tenant access validation
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
 * GET /api/images/[imageId]/thumb
 * Serve the thumbnail image
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

        // Check tenant access
        if (!user.isSuperAdmin && user.tenantId !== image.asset.tenantId) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Stream the file through this route — never redirect to storage.
        // A redirect would hand the caller a URL that outlives the tenant check
        // above, so access could never be withdrawn once granted.
        //
        // Use thumbnail path if available, otherwise fall back to the original
        const storage = getStorage();
        const filePath = image.thumbPath || image.filePath;
        const buffer = await storage.getBuffer(filePath);

        if (!buffer) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Return thumbnail with appropriate headers
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': image.thumbPath ? 'image/jpeg' : image.mimeType,
                'Content-Length': buffer.length.toString(),
                'X-Content-Type-Options': 'nosniff',
                // Revalidate every request so the tenant check above always runs.
                'Cache-Control': 'private, no-cache',
            }
        });

    } catch (error) {
        console.error('Error serving thumbnail:', error);
        return NextResponse.json(
            { error: 'Failed to serve thumbnail' },
            { status: 500 }
        );
    }
}
