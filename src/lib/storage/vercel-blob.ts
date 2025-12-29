/**
 * Vercel Blob Storage Provider
 * 
 * Stores files in Vercel Blob Storage for serverless deployments.
 * Used when BLOB_READ_WRITE_TOKEN environment variable is present.
 */

import { put, del, head } from '@vercel/blob';
import type { StorageProvider } from './types';

export class VercelBlobStorageProvider implements StorageProvider {
    /**
     * Upload a file to Vercel Blob Storage
     * @param buffer - File content as Buffer
     * @param storagePath - Relative storage path (used as pathname)
     * @returns The full blob URL
     */
    async upload(buffer: Buffer, storagePath: string): Promise<string> {
        const { url } = await put(storagePath, buffer, {
            access: 'public',
            addRandomSuffix: false, // Keep exact path for predictability
        });
        return url;
    }

    /**
     * Delete a file from Vercel Blob Storage
     * @param urlOrPath - The full blob URL to delete
     */
    async delete(urlOrPath: string): Promise<void> {
        try {
            // Vercel Blob del() requires the full URL
            await del(urlOrPath);
        } catch (error) {
            // Ignore if blob doesn't exist
            console.warn('Blob delete warning:', error);
        }
    }

    /**
     * Get file as Buffer by fetching from blob URL
     * @param url - The full blob URL
     * @returns File content as Buffer, or null if not found
     */
    async getBuffer(url: string): Promise<Buffer | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Error fetching blob:', error);
            return null;
        }
    }

    /**
     * Check if a blob exists using HEAD request
     * @param url - The full blob URL
     */
    async exists(url: string): Promise<boolean> {
        try {
            const blobDetails = await head(url);
            return !!blobDetails;
        } catch {
            return false;
        }
    }
}
