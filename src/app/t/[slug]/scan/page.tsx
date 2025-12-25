import { Metadata } from "next";
import { requireTenantAccess } from "@/lib/auth";
import { ScanForm } from "./scan-form";

interface ScanPageProps {
    params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
    title: "Scan Asset",
    description: "Scan barcode or enter serial number to lookup assets",
};

/**
 * Scan Page - Lookup assets by barcode/serial/ID
 */
export default async function ScanPage({ params }: ScanPageProps) {
    const { slug } = await params;
    const { tenant } = await requireTenantAccess(slug);

    return (
        <div className="mx-auto max-w-md">
            <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <svg
                        className="w-8 h-8 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold">Scan Asset</h1>
                <p className="text-muted-foreground mt-2">
                    Scan a barcode or enter asset ID/serial number
                </p>
            </div>

            <ScanForm tenantSlug={slug} />

            <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>Tip: USB barcode scanners work like keyboards.</p>
                <p>Just focus the input field and scan!</p>
            </div>
        </div>
    );
}
