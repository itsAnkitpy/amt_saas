/**
 * Asset Images API
 * 
 * POST - Upload image(s) to an asset
 * GET  - List all images for an asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkTenantAccessForApi } from '@/lib/auth';
import {
    getStorage,
    IMAGE_CONFIG,
    isAllowedMimeType,
    generateFileName,
    buildAssetImagePath
} from '@/lib/storage';
import { createThumbnail } from '@/lib/storage/image-utils';

interface RouteParams {
    params: Promise<{
        slug: string;
        id: string;
    }>;
}

/**
 * GET /api/tenants/[slug]/assets/[id]/images
 * List all images for an asset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id: assetId } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;

        // Verify asset belongs to tenant
        const asset = await db.asset.findFirst({
            where: { id: assetId, tenantId: tenant.id },
            include: {
                images: {
                    orderBy: [
                        { isPrimary: 'desc' },
                        { sortOrder: 'asc' },
                        { createdAt: 'desc' }
                    ]
                }
            }
        });

        if (!asset) {
            return NextResponse.json(
                { error: 'Asset not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ images: asset.images });
    } catch (error) {
        console.error('Error listing images:', error);
        return NextResponse.json(
            { error: 'Failed to list images' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/tenants/[slug]/assets/[id]/images
 * Upload image(s) to an asset
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug, id: assetId } = await params;
        const authResult = await checkTenantAccessForApi(slug);

        if ('error' in authResult) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { tenant } = authResult;

        // Verify asset belongs to tenant
        const asset = await db.asset.findFirst({
            where: { id: assetId, tenantId: tenant.id },
            include: { _count: { select: { images: true } } }
        });

        if (!asset) {
            return NextResponse.json(
                { error: 'Asset not found' },
                { status: 404 }
            );
        }

        // Check max images limit
        if (asset._count.images >= IMAGE_CONFIG.maxImagesPerAsset) {
            return NextResponse.json(
                { error: `Maximum ${IMAGE_CONFIG.maxImagesPerAsset} images per asset` },
                { status: 400 }
            );
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!isAllowedMimeType(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > IMAGE_CONFIG.maxFileSize) {
            const maxMB = IMAGE_CONFIG.maxFileSize / (1024 * 1024);
            return NextResponse.json(
                { error: `File too large. Maximum size: ${maxMB}MB` },
                { status: 400 }
            );
        }

        // Get storage provider
        const storage = getStorage();

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Generate filenames
        const originalName = generateFileName(file.name, 'original-');
        const thumbName = generateFileName(file.name, 'thumb-').replace(/\.[^.]+$/, '.jpg');

        // Build storage paths
        const originalPath = buildAssetImagePath(tenant.id, assetId, originalName);
        const thumbPath = buildAssetImagePath(tenant.id, assetId, thumbName);

        // Generate thumbnail
        const thumbBuffer = await createThumbnail(buffer);

        // Upload both files
        await Promise.all([
            storage.upload(buffer, originalPath),
            storage.upload(thumbBuffer, thumbPath)
        ]);

        // Determine if this should be primary (first image)
        const isPrimary = asset._count.images === 0;

        // Create database record
        const image = await db.assetImage.create({
            data: {
                assetId,
                fileName: file.name,
                filePath: originalPath,
                thumbPath: thumbPath,
                mimeType: file.type,
                size: file.size,
                isPrimary,
                sortOrder: asset._count.images
            }
        });

        return NextResponse.json({
            image,
            message: 'Image uploaded successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error uploading image:', error);
        return NextResponse.json(
            { error: 'Failed to upload image' },
            { status: 500 }
        );
    }
}
