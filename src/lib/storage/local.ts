/**
 * Local Storage Provider
 * 
 * Stores files in ./storage/uploads/ directory (private, not web-accessible).
 * For development use. In production, switch to S3StorageProvider.
 */

import fs from 'fs/promises';
import path from 'path';
import type { StorageProvider } from './types';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads');

export class LocalStorageProvider implements StorageProvider {
    /**
     * Ensure directory exists before writing
     */
    private async ensureDir(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    /**
     * Get absolute path from relative storage path
     */
    private getAbsolutePath(relativePath: string): string {
        return path.join(STORAGE_ROOT, relativePath);
    }

    async upload(buffer: Buffer, storagePath: string): Promise<string> {
        const absolutePath = this.getAbsolutePath(storagePath);
        await this.ensureDir(absolutePath);
        await fs.writeFile(absolutePath, buffer);
        return storagePath;
    }

    async delete(storagePath: string): Promise<void> {
        const absolutePath = this.getAbsolutePath(storagePath);
        try {
            await fs.unlink(absolutePath);
        } catch (error) {
            // Ignore if file doesn't exist
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async getBuffer(storagePath: string): Promise<Buffer | null> {
        const absolutePath = this.getAbsolutePath(storagePath);
        try {
            return await fs.readFile(absolutePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async exists(storagePath: string): Promise<boolean> {
        const absolutePath = this.getAbsolutePath(storagePath);
        try {
            await fs.access(absolutePath);
            return true;
        } catch {
            return false;
        }
    }
}
