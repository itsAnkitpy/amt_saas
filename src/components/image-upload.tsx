'use client';

/**
 * Image Upload Component
 * 
 * Drag & drop image upload with preview and progress.
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
    tenantSlug: string;
    assetId: string;
    onUploadComplete?: () => void;
}

interface UploadingFile {
    file: File;
    preview: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}

export function ImageUpload({ tenantSlug, assetId, onUploadComplete }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const uploadFile = async (file: File, index: number) => {
        // Update status to uploading
        setUploadingFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: 'uploading' } : f
        ));

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
                `/api/tenants/${tenantSlug}/assets/${assetId}/images`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Upload failed');
            }

            // Update status to success
            setUploadingFiles(prev => prev.map((f, i) =>
                i === index ? { ...f, status: 'success' } : f
            ));

        } catch (error) {
            // Update status to error
            setUploadingFiles(prev => prev.map((f, i) =>
                i === index ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Upload failed'
                } : f
            ));
        }
    };

    const processFiles = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) return;

        // IMPORTANT: Capture startIndex BEFORE updating state
        // React setState is async, so reading uploadingFiles.length after
        // would give the old value
        const startIndex = uploadingFiles.length;

        // Create upload entries with previews
        const newFiles: UploadingFile[] = imageFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            status: 'pending' as const
        }));

        setUploadingFiles(prev => [...prev, ...newFiles]);

        // Upload each file using the pre-captured startIndex
        for (let i = 0; i < newFiles.length; i++) {
            await uploadFile(newFiles[i].file, startIndex + i);
        }

        // Notify parent after all uploads
        onUploadComplete?.();

        // Clear successful uploads after a delay, revoking Object URLs to prevent memory leaks
        setTimeout(() => {
            setUploadingFiles(prev => {
                // Revoke URLs of successful uploads before removing them
                prev.forEach(f => {
                    if (f.status === 'success' && f.preview) {
                        URL.revokeObjectURL(f.preview);
                    }
                });
                return prev.filter(f => f.status !== 'success');
            });
        }, 2000);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(e.dataTransfer.files);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const removeFile = (index: number) => {
        setUploadingFiles(prev => {
            const file = prev[index];
            if (file?.preview) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${isDragging
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                        : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700'
                    }
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <Upload className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                    JPEG, PNG, WebP, GIF (max 5MB each)
                </p>
            </div>

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                    {uploadingFiles.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 p-2 border rounded-lg bg-white dark:bg-zinc-900"
                        >
                            {/* Preview */}
                            <div className="h-12 w-12 rounded overflow-hidden bg-zinc-100 flex-shrink-0">
                                {item.preview ? (
                                    <img
                                        src={item.preview}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon className="h-full w-full p-2 text-zinc-400" />
                                )}
                            </div>

                            {/* File name */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{item.file.name}</p>
                                {item.error && (
                                    <p className="text-xs text-red-500">{item.error}</p>
                                )}
                            </div>

                            {/* Status */}
                            <div className="flex-shrink-0">
                                {item.status === 'uploading' && (
                                    <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                                )}
                                {item.status === 'success' && (
                                    <span className="text-green-500 text-sm">✓</span>
                                )}
                                {item.status === 'error' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFile(index)}
                                    >
                                        <X className="h-4 w-4 text-red-500" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
