'use client';

/**
 * Asset Images Section
 * 
 * Client wrapper for ImageGallery that handles data fetching and refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { ImageGallery, GalleryImage } from '@/components/image-gallery';
import { ImageUpload } from '@/components/image-upload';
import { Loader2 } from 'lucide-react';

interface AssetImagesSectionProps {
    tenantSlug: string;
    assetId: string;
    isAdmin: boolean;
}

export function AssetImagesSection({ tenantSlug, assetId, isAdmin }: AssetImagesSectionProps) {
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchImages = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/tenants/${tenantSlug}/assets/${assetId}/images`
            );
            if (response.ok) {
                const data = await response.json();
                setImages(data.images);
            }
        } catch (error) {
            console.error('Failed to fetch images:', error);
        } finally {
            setLoading(false);
        }
    }, [tenantSlug, assetId]);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Gallery */}
            <ImageGallery
                images={images}
                tenantSlug={tenantSlug}
                assetId={assetId}
                editable={isAdmin}
                onImageDeleted={fetchImages}
                onPrimaryChanged={fetchImages}
            />

            {/* Upload (admin only) */}
            {isAdmin && (
                <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Add Images</h4>
                    <ImageUpload
                        tenantSlug={tenantSlug}
                        assetId={assetId}
                        onUploadComplete={fetchImages}
                    />
                </div>
            )}
        </div>
    );
}
