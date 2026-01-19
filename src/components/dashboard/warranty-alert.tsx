import { AlertTriangle, AlertOctagon, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface WarrantyAsset {
    id: string;
    name: string;
    warrantyEnd: Date;
}

interface WarrantyAlertProps {
    expiringAssets: WarrantyAsset[];
    expiredAssets: WarrantyAsset[];
    tenantSlug: string;
}

/**
 * Warranty Alert Component
 * 
 * Displays assets with expired warranties and warranties expiring soon.
 * Expired warranties are shown as critical (red), expiring as warning (amber).
 */
export function WarrantyAlert({ expiringAssets, expiredAssets, tenantSlug }: WarrantyAlertProps) {
    const displayExpired = expiredAssets.slice(0, 3);
    const displayExpiring = expiringAssets.slice(0, 3);
    const hasMoreExpired = expiredAssets.length > 3;
    const hasMoreExpiring = expiringAssets.length > 3;
    const totalCount = expiredAssets.length + expiringAssets.length;

    // Empty state - all warranties are current
    if (totalCount === 0) {
        return (
            <div className="flex h-48 flex-col items-center justify-center text-center">
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                    <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">
                    All warranties are up to date
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                    No warranty alerts at this time
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Already Expired Section - Critical (Red) */}
            {expiredAssets.length > 0 && (
                <div>
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                        <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                            {expiredAssets.length} expired warrant{expiredAssets.length !== 1 ? 'ies' : 'y'}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {displayExpired.map((asset) => (
                            <Link
                                key={asset.id}
                                href={`/t/${tenantSlug}/assets/${asset.id}`}
                                className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                                        {asset.name}
                                    </p>
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        Expired {formatDistanceToNow(new Date(asset.warrantyEnd), { addSuffix: true })}
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-red-400" />
                            </Link>
                        ))}
                    </div>
                    {hasMoreExpired && (
                        <Link
                            href={`/t/${tenantSlug}/assets?warrantyExpired=true`}
                            className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                            View all {expiredAssets.length} expired
                            <ChevronRight className="h-3 w-3" />
                        </Link>
                    )}
                </div>
            )}

            {/* Expiring Soon Section - Warning (Amber) */}
            {expiringAssets.length > 0 && (
                <div>
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            {expiringAssets.length} expiring in 30 days
                        </span>
                    </div>
                    <div className="space-y-2">
                        {displayExpiring.map((asset) => (
                            <Link
                                key={asset.id}
                                href={`/t/${tenantSlug}/assets/${asset.id}`}
                                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                                        {asset.name}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        Expires {formatDistanceToNow(new Date(asset.warrantyEnd), { addSuffix: true })}
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                            </Link>
                        ))}
                    </div>
                    {hasMoreExpiring && (
                        <Link
                            href={`/t/${tenantSlug}/assets?warrantyExpiring=true`}
                            className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                        >
                            View all {expiringAssets.length} expiring
                            <ChevronRight className="h-3 w-3" />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
