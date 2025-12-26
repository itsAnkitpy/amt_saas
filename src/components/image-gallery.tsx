'use client';

/**
 * Image Gallery Component
 * 
 * Displays asset images with lightbox, primary indicator, and management controls.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryImage {
    id: string;
    fileName: string;
    isPrimary: boolean;
}

interface ImageGalleryProps {
    images: GalleryImage[];
    tenantSlug: string;
    assetId: string;
    editable?: boolean;
    onImageDeleted?: () => void;
    onPrimaryChanged?: () => void;
}

export function ImageGallery({
    images,
    tenantSlug,
    assetId,
    editable = false,
    onImageDeleted,
    onPrimaryChanged
}: ImageGalleryProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

    if (images.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-500">
                <p>No images uploaded</p>
            </div>
        );
    }

    const openLightbox = (index: number) => {
        setCurrentIndex(index);
        setLightboxOpen(true);
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
    };

    const nextImage = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const handleDelete = async (imageId: string) => {
        if (!confirm('Delete this image?')) return;

        setDeleting(imageId);
        try {
            const response = await fetch(
                `/api/tenants/${tenantSlug}/assets/${assetId}/images/${imageId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                onImageDeleted?.();
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
        }
        setDeleting(null);
    };

    const handleSetPrimary = async (imageId: string) => {
        setSettingPrimary(imageId);
        try {
            const response = await fetch(
                `/api/tenants/${tenantSlug}/assets/${assetId}/images/${imageId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isPrimary: true })
                }
            );

            if (response.ok) {
                onPrimaryChanged?.();
            }
        } catch (error) {
            console.error('Failed to set primary:', error);
        }
        setSettingPrimary(null);
    };

    return (
        <>
            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                    <div
                        key={image.id}
                        className="relative group aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
                        onClick={() => openLightbox(index)}
                    >
                        {/* Thumbnail */}
                        <img
                            src={`/api/images/${image.id}/thumb`}
                            alt={image.fileName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Show placeholder on error
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder');
                                if (placeholder) placeholder.classList.remove('hidden');
                            }}
                        />
                        {/* Placeholder for broken images */}
                        <div className="placeholder hidden absolute inset-0 flex items-center justify-center text-zinc-400">
                            <Star className="h-8 w-8" />
                        </div>

                        {/* Primary Badge */}
                        {image.isPrimary && (
                            <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                Primary
                            </div>
                        )}

                        {/* Edit Controls - Only show on hover for admins */}
                        {editable && (
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                {!image.isPrimary && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => { e.stopPropagation(); handleSetPrimary(image.id); }}
                                        disabled={settingPrimary === image.id}
                                    >
                                        <Star className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(image.id); }}
                                    disabled={deleting === image.id}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox */}
            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    {/* Close Button */}
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                        onClick={closeLightbox}
                    >
                        <X className="h-8 w-8" />
                    </button>

                    {/* Navigation */}
                    {images.length > 1 && (
                        <>
                            <button
                                className="absolute left-4 text-white hover:text-gray-300 z-10"
                                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                            >
                                <ChevronLeft className="h-10 w-10" />
                            </button>
                            <button
                                className="absolute right-4 text-white hover:text-gray-300 z-10"
                                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                            >
                                <ChevronRight className="h-10 w-10" />
                            </button>
                        </>
                    )}

                    {/* Image */}
                    <img
                        src={`/api/images/${images[currentIndex].id}`}
                        alt={images[currentIndex].fileName}
                        className="max-h-[90vh] max-w-[90vw] object-contain"
                        onClick={(e) => e.stopPropagation()}
                        onError={(e) => {
                            // Show error message for broken images in lightbox
                            e.currentTarget.style.display = 'none';
                        }}
                    />

                    {/* Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
                        {currentIndex + 1} / {images.length}
                    </div>
                </div>
            )}
        </>
    );
}
