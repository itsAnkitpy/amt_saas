/**
 * Storage Provider Factory
 * 
 * Returns the appropriate storage provider based on environment.
 * Currently only LocalStorageProvider is implemented.
 * Add S3StorageProvider when ready for production.
 */

import type { StorageProvider } from './types';
import { LocalStorageProvider } from './local';

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
 * Usage:
 * ```typescript
 * import { getStorage } from '@/lib/storage';
 * const storage = getStorage();
 * await storage.upload(buffer, 'tenant/assets/asset-id/image.jpg');
 * ```
 */
export function getStorage(): StorageProvider {
    if (!storageProvider) {
        // TODO: Check env for STORAGE_PROVIDER=s3 and return S3StorageProvider
        storageProvider = new LocalStorageProvider();
    }
    return storageProvider;
}
