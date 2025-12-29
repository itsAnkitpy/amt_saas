/**
 * Storage Provider Factory
 * 
 * Returns the appropriate storage provider based on environment.
 * - Vercel Blob: When BLOB_READ_WRITE_TOKEN is present (staging/production)
 * - Local Storage: For local development
 */

import type { StorageProvider } from './types';
import { LocalStorageProvider } from './local';
import { VercelBlobStorageProvider } from './vercel-blob';

// Re-export types and utilities
export type { StorageProvider } from './types';
export {
    IMAGE_CONFIG,
    isAllowedMimeType,
    generateFileName,
    buildAssetImagePath
} from './types';

// Singleton instance
let storageProvider: StorageProvider | null = null;

/**
 * Get the storage provider instance
 * 
 * Provider selection priority:
 * 1. Vercel Blob (when BLOB_READ_WRITE_TOKEN is set)
 * 2. Local Storage (default for development)
 * 
 * Usage:
 * ```typescript
 * import { getStorage } from '@/lib/storage';
 * const storage = getStorage();
 * await storage.upload(buffer, 'tenant/assets/asset-id/image.jpg');
 * ```
 */
export function getStorage(): StorageProvider {
    if (!storageProvider) {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            console.log('[Storage] Using Vercel Blob Storage');
            storageProvider = new VercelBlobStorageProvider();
        } else {
            console.log('[Storage] Using Local Storage');
            storageProvider = new LocalStorageProvider();
        }
    }
    return storageProvider;
}

