/**
 * Storage Provider Interface
 * 
 * Abstract interface for file storage operations.
 * Allows easy switching between local and cloud storage (S3).
 */

export interface StorageProvider {
    /**
     * Upload a file to storage
     * @param buffer - File content as Buffer
     * @param path - Relative storage path (e.g., "tenant-id/assets/asset-id/image.jpg")
     * @returns The storage path
     */
    upload(buffer: Buffer, path: string): Promise<string>;

    /**
     * Delete a file from storage
     * @param path - Relative storage path
     */
    delete(path: string): Promise<void>;

    /**
     * Get file as Buffer for serving via API
     * @param path - Relative storage path
     * @returns File content as Buffer, or null if not found
     */
    getBuffer(path: string): Promise<Buffer | null>;

    /**
     * Check if a file exists
     * @param path - Relative storage path
     */
    exists(path: string): Promise<boolean>;
}

/**
 * Image upload configuration
 */
export const IMAGE_CONFIG = {
    maxFileSize: 5 * 1024 * 1024, // 5MB per file
    maxImagesPerAsset: 10,
    allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ] as const,
    thumbnail: {
        width: 300,
        height: 300,
        quality: 80
    }
} as const;

export type AllowedMimeType = typeof IMAGE_CONFIG.allowedMimeTypes[number];

/**
 * Validate if a mime type is allowed
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
    return IMAGE_CONFIG.allowedMimeTypes.includes(mimeType as AllowedMimeType);
}

/**
 * Generate a unique filename with original extension
 */
export function generateFileName(originalName: string, prefix: string = ''): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}-${random}.${ext}`;
}

/**
 * Build storage path for an asset image
 */
export function buildAssetImagePath(
    tenantId: string,
    assetId: string,
    fileName: string
): string {
    return `${tenantId}/assets/${assetId}/${fileName}`;
}
