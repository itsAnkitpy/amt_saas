/**
 * Image Processing Utilities
 * 
 * Uses Sharp for image resizing and thumbnail generation.
 */

import sharp from 'sharp';
import { IMAGE_CONFIG } from './types';

/**
 * Create a thumbnail from an image buffer
 * 
 * @param buffer - Original image buffer
 * @returns Thumbnail image buffer as JPEG
 */
export async function createThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize(IMAGE_CONFIG.thumbnail.width, IMAGE_CONFIG.thumbnail.height, {
            fit: 'cover',      // Crop to fill the square
            position: 'center' // Center the crop
        })
        .jpeg({ quality: IMAGE_CONFIG.thumbnail.quality })
        .toBuffer();
}

/**
 * Get image metadata (dimensions, format)
 * 
 * @param buffer - Image buffer
 * @returns Image metadata
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
    width: number | undefined;
    height: number | undefined;
    format: string | undefined;
}> {
    const metadata = await sharp(buffer).metadata();
    return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
    };
}

/**
 * Optimize image for storage (optional resizing, quality adjustment)
 * 
 * @param buffer - Original image buffer
 * @param maxWidth - Optional max width (preserves aspect ratio)
 * @returns Optimized image buffer
 */
export async function optimizeImage(
    buffer: Buffer,
    maxWidth: number = 2000
): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();

    // Only resize if larger than maxWidth
    if (metadata.width && metadata.width > maxWidth) {
        return sharp(buffer)
            .resize(maxWidth, null, { withoutEnlargement: true })
            .toBuffer();
    }

    // Return original if already small enough
    return buffer;
}
