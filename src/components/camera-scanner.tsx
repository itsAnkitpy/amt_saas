'use client';

import { useState, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2 } from 'lucide-react';

interface CameraScannerProps {
    onScan: (value: string) => void;
    onError?: (error: Error) => void;
}

/**
 * Camera Scanner Component
 * Uses device camera to scan QR codes and barcodes
 */
export function CameraScanner({ onScan, onError }: CameraScannerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpen = () => {
        setIsOpen(true);
        setIsLoading(true);
        setError(null);

        // Fallback: hide loading after 3 seconds if camera doesn't trigger ready
        setTimeout(() => {
            setIsLoading(false);
        }, 3000);
    };

    // Called when camera stream is ready
    const handleCameraReady = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setIsLoading(false);
        setError(null);
    };

    const handleScan = useCallback((detectedCodes: { rawValue: string }[]) => {
        if (detectedCodes.length > 0) {
            const value = detectedCodes[0].rawValue;
            if (value) {
                onScan(value);
                handleClose();
            }
        }
    }, [onScan]);

    const handleError = useCallback((err: unknown) => {
        console.error('Camera error:', err);
        setIsLoading(false);

        if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found on this device.');
            } else {
                setError(err.message);
            }
            onError?.(err);
        } else {
            setError('Failed to access camera');
        }
    }, [onError]);

    return (
        <>
            {/* Camera Button */}
            <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleOpen}
                className="shrink-0"
            >
                <Camera className="h-5 w-5" />
            </Button>

            {/* Camera Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
                    <div className="relative w-full max-w-md mx-4">
                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
                            <h3 className="text-white font-semibold">
                                Scan QR Code or Barcode
                            </h3>
                            <button
                                onClick={handleClose}
                                className="text-white hover:text-gray-300 p-2"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Scanner */}
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                                    <div className="text-center text-white">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                        <p>Starting camera...</p>
                                    </div>
                                </div>
                            )}

                            {error ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black">
                                    <div className="text-center text-white p-4">
                                        <p className="text-red-400 mb-4">{error}</p>
                                        <Button variant="outline" onClick={handleClose}>
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Scanner
                                    onScan={(result) => {
                                        setIsLoading(false);
                                        handleScan(result);
                                    }}
                                    onError={handleError}
                                    formats={[
                                        'qr_code',
                                        'code_128',
                                        'code_39',
                                        'ean_13',
                                        'ean_8',
                                        'upc_a',
                                        'upc_e',
                                        'data_matrix',
                                    ]}
                                    components={{
                                        onOff: false,
                                        torch: false,
                                        finder: true,
                                    }}
                                    styles={{
                                        container: {
                                            width: '100%',
                                            height: '100%',
                                        },
                                        video: {
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        },
                                    }}
                                />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
                            <p className="text-white text-sm">
                                Point camera at QR code or barcode
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
