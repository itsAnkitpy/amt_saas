/**
 * Vercel Blob Storage Provider
 *
 * Stores files in a PRIVATE Vercel Blob store for serverless deployments.
 * Used when BLOB_STORE_ID is present (see ./index.ts).
 *
 * Private store: blobs have no publicly reachable URL. Every read goes through
 * this provider, which authenticates with a short-lived OIDC token on Vercel
 * (or BLOB_READ_WRITE_TOKEN off-platform). Callers therefore pass storage
 * PATHS — never URLs — exactly as LocalStorageProvider does.
 */

import { put, del, head, get } from '@vercel/blob';
import type { StorageProvider } from './types';

export class VercelBlobStorageProvider implements StorageProvider {
    /**
     * Upload a file to the private Blob store
     * @param buffer - File content as Buffer
     * @param storagePath - Relative storage path (used as pathname)
     * @returns The storage path (matches LocalStorageProvider)
     */
    async upload(buffer: Buffer, storagePath: string): Promise<string> {
        await put(storagePath, buffer, {
            access: 'private',
            addRandomSuffix: false, // Keep exact path for predictability
        });
        return storagePath;
    }

    /**
     * Delete a file from the Blob store
     * @param storagePath - Relative storage path
     */
    async delete(storagePath: string): Promise<void> {
        try {
            await del(storagePath);
        } catch (error) {
            // Ignore if blob doesn't exist
            console.warn('Blob delete warning:', error);
        }
    }

    /**
     * Get file as Buffer, authenticated against the private store
     * @param storagePath - Relative storage path
     * @returns File content as Buffer, or null if not found
     */
    async getBuffer(storagePath: string): Promise<Buffer | null> {
        try {
            const result = await get(storagePath, { access: 'private' });
            if (result?.statusCode !== 200) {
                return null;
            }
            // Images are capped at IMAGE_CONFIG.maxFileSize (5MB), so buffering
            // the whole body is fine. Switch to streaming if that cap ever rises.
            const arrayBuffer = await new Response(result.stream).arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Error fetching blob:', error);
            return null;
        }
    }

    /**
     * Check if a file exists in the Blob store
     * @param storagePath - Relative storage path
     */
    async exists(storagePath: string): Promise<boolean> {
        try {
            const blobDetails = await head(storagePath);
            return !!blobDetails;
        } catch {
            return false;
        }
    }
}
