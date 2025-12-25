'use client';

import QRCode from 'react-qr-code';

interface AssetQRCodeProps {
    assetId: string;
    size?: number;
}

/**
 * Displays a QR code for an asset
 * The QR code encodes the asset ID which can be scanned to look up the asset
 */
export function AssetQRCode({ assetId, size = 128 }: AssetQRCodeProps) {
    return (
        <div className="bg-white p-3 rounded-lg inline-block">
            <QRCode
                value={assetId}
                size={size}
                level="M" // Error correction level: L, M, Q, H
            />
        </div>
    );
}
