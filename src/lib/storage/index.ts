/**
 * Storage Provider Factory
 * 
 * Returns the appropriate storage provider based on environment.
 * - Vercel Blob: When BLOB_STORE_ID is present (staging/production)
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
 * 1. Vercel Blob (when BLOB_STORE_ID is set)
 * 2. Local Storage (default for development)
 *
 * Selection keys off BLOB_STORE_ID, not BLOB_READ_WRITE_TOKEN: with a private
 * store on Vercel the SDK uses a short-lived OIDC token and no read/write token
 * exists in the environment. Keying off the token would silently fall back to
 * LocalStorageProvider in production, writing uploads to an ephemeral serverless
 * filesystem that is wiped on every deploy.
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
        if (process.env.BLOB_STORE_ID) {
            storageProvider = new VercelBlobStorageProvider();
        } else {
            storageProvider = new LocalStorageProvider();
        }
    }
    return storageProvider;
}
