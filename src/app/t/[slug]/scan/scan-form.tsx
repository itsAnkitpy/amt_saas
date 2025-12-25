'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Plus, ArrowRight, UserPlus, RotateCcw, X } from 'lucide-react';
import { CameraScanner } from '@/components/camera-scanner';
import { quickAssignAsset, quickUnassignAsset } from './actions';

interface ScanFormProps {
    tenantSlug: string;
}

interface User {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
}

interface LookupResult {
    found: boolean;
    asset?: {
        id: string;
        name: string;
        serialNumber?: string | null;
        assetTag?: string | null;
        status: string;
        assignedTo?: {
            id: string;
            firstName: string;
            lastName: string | null;
            email: string;
        } | null;
    };
}

/**
 * Client component for scanning/searching assets with quick actions
 */
export function ScanForm({ tenantSlug }: ScanFormProps) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
    const [result, setResult] = useState<LookupResult | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Auto-focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Fetch users when needed for assignment
    const fetchUsers = async () => {
        try {
            const res = await fetch(`/api/tenants/${tenantSlug}/users`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

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
        setShowAssignModal(false);
        setSelectedUserId('');
        inputRef.current?.focus();
    };

    const openAssignModal = async () => {
        if (users.length === 0) {
            await fetchUsers();
        }
        setShowAssignModal(true);
    };

    const handleAssign = async () => {
        if (!result?.asset || !selectedUserId) return;

        setIsProcessing(true);
        const response = await quickAssignAsset(tenantSlug, result.asset.id, selectedUserId);

        if (response.success) {
            // Refresh the search to show updated status
            setShowAssignModal(false);
            setSelectedUserId('');
            await handleSearch();
        } else {
            alert(response.error || 'Failed to assign asset');
        }
        setIsProcessing(false);
    };

    const handleUnassign = async () => {
        if (!result?.asset) return;

        setIsProcessing(true);
        const response = await quickUnassignAsset(tenantSlug, result.asset.id);

        if (response.success) {
            // Refresh the search to show updated status
            await handleSearch();
        } else {
            alert(response.error || 'Failed to return asset');
        }
        setIsProcessing(false);
    };

    const asset = result?.asset;
    const isAvailable = asset?.status === 'AVAILABLE';
    const isAssigned = asset?.status === 'ASSIGNED';

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
                <CameraScanner
                    onScan={async (scannedValue) => {
                        setQuery(scannedValue);
                        // Immediately search with scanned value
                        setStatus('searching');
                        setResult(null);
                        try {
                            const response = await fetch(
                                `/api/tenants/${tenantSlug}/assets/lookup?q=${encodeURIComponent(scannedValue)}`
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
                    }}
                />
            </div>

            {/* Asset Found - Available */}
            {status === 'found' && asset && isAvailable && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                    Asset Available
                                </p>
                                <h3 className="text-lg font-bold mt-1">{asset.name}</h3>
                                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                    {asset.assetTag && <span>Tag: {asset.assetTag}</span>}
                                    {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
                                </div>
                                <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                                    {asset.status}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={goToAsset}>
                                    View
                                </Button>
                                <Button size="sm" onClick={openAssignModal} disabled={isProcessing}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Assign
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Asset Found - Assigned */}
            {status === 'found' && asset && isAssigned && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    Asset Assigned
                                </p>
                                <h3 className="text-lg font-bold mt-1">{asset.name}</h3>
                                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                    {asset.assetTag && <span>Tag: {asset.assetTag}</span>}
                                    {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
                                </div>
                                {asset.assignedTo && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-blue-700 text-xs font-medium">
                                            {asset.assignedTo.firstName[0]}
                                        </div>
                                        <span className="text-sm font-medium">
                                            {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            ({asset.assignedTo.email})
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={goToAsset}>
                                    View
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleUnassign}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                    )}
                                    Return
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Asset Found - Other Status */}
            {status === 'found' && asset && !isAvailable && !isAssigned && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                                    Asset Found
                                </p>
                                <h3 className="text-lg font-bold mt-1">{asset.name}</h3>
                                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                    {asset.assetTag && <span>Tag: {asset.assetTag}</span>}
                                    {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
                                </div>
                                <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                                    {asset.status}
                                </span>
                            </div>
                            <Button variant="outline" onClick={goToAsset}>
                                View <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Not Found */}
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

            {/* Idle State */}
            {status === 'idle' && (
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                        Enter an asset ID, serial number, or asset tag
                    </p>
                </div>
            )}

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900 mx-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Quick Assign Asset</h3>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="text-zinc-400 hover:text-zinc-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-zinc-100 rounded-lg dark:bg-zinc-800">
                            <p className="font-medium">{asset?.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {asset?.assetTag || asset?.serialNumber}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label>Select User *</Label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.firstName} {user.lastName} ({user.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowAssignModal(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssign}
                                disabled={!selectedUserId || isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    'Assign'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
