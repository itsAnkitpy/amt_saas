'use client';

import { Button } from '@/components/ui/button';
import { PrinterIcon } from 'lucide-react';
import QRCode from 'react-qr-code';
import { renderToString } from 'react-dom/server';

interface Asset {
  id: string;
  name: string;
  serialNumber?: string | null;
  assetTag?: string | null;
}

interface PrintLabelButtonProps {
  asset: Asset;
  tenantName?: string;
}

/**
 * Button that prints an asset label with QR code
 * Uses a hidden iframe for more reliable printing/PDF saving
 */
export function PrintLabelButton({ asset, tenantName }: PrintLabelButtonProps) {
  const handlePrint = () => {
    // Generate QR code as SVG string
    const qrSvg = renderToString(
      <QRCode
        value={asset.id}
        size={100}
        level="M"
      />
    );

    // Create label HTML
    const labelHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Label - ${asset.name}</title>
          <style>
            @page {
              size: 80mm 50mm;
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 5mm;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              background: white;
            }
            .label {
              width: 70mm;
              text-align: center;
            }
            .tenant {
              font-size: 9pt;
              color: #666;
              margin-bottom: 2mm;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              margin: 2mm 0;
            }
            .qr-container svg {
              width: 20mm;
              height: 20mm;
            }
            .name {
              font-weight: bold;
              font-size: 11pt;
              margin: 2mm 0;
              word-wrap: break-word;
            }
            .tag {
              font-size: 14pt;
              font-weight: bold;
              margin: 1mm 0;
            }
            .serial {
              font-size: 9pt;
              color: #333;
            }
            .id {
              font-size: 7pt;
              color: #999;
              margin-top: 1mm;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${tenantName ? `<div class="tenant">${tenantName}</div>` : ''}
            <div class="qr-container">${qrSvg}</div>
            <div class="name">${asset.name}</div>
            ${asset.assetTag ? `<div class="tag">${asset.assetTag}</div>` : ''}
            ${asset.serialNumber ? `<div class="serial">S/N: ${asset.serialNumber}</div>` : ''}
            <div class="id">${asset.id}</div>
          </div>
        </body>
      </html>
    `;

    // Create a Blob and download/print
    const blob = new Blob([labelHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Open in new window for printing
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } else {
      alert('Please allow popups for printing');
    }

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <PrinterIcon className="mr-2 h-4 w-4" />
      Print Label
    </Button>
  );
}
