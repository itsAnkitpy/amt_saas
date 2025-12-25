'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Plus, ArrowRight } from 'lucide-react';

interface ScanFormProps {
    tenantSlug: string;
}

interface LookupResult {
    found: boolean;
    asset?: {
        id: string;
        name: string;
        serialNumber?: string | null;
        assetTag?: string | null;
        status: string;
    };
}

/**
 * Client component for scanning/searching assets
 */
export function ScanForm({ tenantSlug }: ScanFormProps) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
    const [result, setResult] = useState<LookupResult | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Auto-focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSearch = async () => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;

        setStatus('searching');
        setResult(null);

        try {
            const response = await fetch(
                `/api/tenants/${tenantSlug}/assets/lookup?q=${encodeURIComponent(trimmedQuery)}`
            );
            const data = await response.json();

            if (data.asset) {
                setStatus('found');
                setResult({ found: true, asset: data.asset });
            } else {
                setStatus('not-found');
                setResult({ found: false });
            }
        } catch (error) {
            console.error('Lookup failed:', error);
            setStatus('not-found');
            setResult({ found: false });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    const goToAsset = () => {
        if (result?.asset) {
            router.push(`/t/${tenantSlug}/assets/${result.asset.id}`);
        }
    };

    const createNewAsset = () => {
        router.push(`/t/${tenantSlug}/assets/new?serial=${encodeURIComponent(query)}`);
    };

    const resetSearch = () => {
        setQuery('');
        setStatus('idle');
        setResult(null);
        inputRef.current?.focus();
    };

    return (
        <div className="space-y-6">
            {/* Search Input */}
            <div className="flex gap-2">
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Scan barcode or enter ID/serial..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-lg h-12"
                    disabled={status === 'searching'}
                />
                <Button
                    size="lg"
                    onClick={handleSearch}
                    disabled={!query.trim() || status === 'searching'}
                >
                    {status === 'searching' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Search className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {/* Result Display */}
            {status === 'found' && result?.asset && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                    Asset Found!
                                </p>
                                <h3 className="text-lg font-bold mt-1">{result.asset.name}</h3>
                                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                    {result.asset.assetTag && (
                                        <span>Tag: {result.asset.assetTag}</span>
                                    )}
                                    {result.asset.serialNumber && (
                                        <span>S/N: {result.asset.serialNumber}</span>
                                    )}
                                </div>
                                <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                    {result.asset.status}
                                </span>
                            </div>
                            <Button onClick={goToAsset}>
                                View <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {status === 'not-found' && (
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
                    <CardContent className="p-4">
                        <div className="text-center">
                            <p className="text-orange-600 dark:text-orange-400 font-medium">
                                No asset found for &quot;{query}&quot;
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Would you like to create a new asset with this serial number?
                            </p>
                            <div className="flex justify-center gap-3 mt-4">
                                <Button variant="outline" onClick={resetSearch}>
                                    Search Again
                                </Button>
                                <Button onClick={createNewAsset}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Asset
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions */}
            {status === 'idle' && (
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                        Enter an asset ID, serial number, or asset tag
                    </p>
                </div>
            )}
        </div>
    );
}
