'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    EyeIcon,
    ImageIcon,
    ChevronDownIcon,
    CheckCircleIcon,
    RotateCcwIcon,
    WrenchIcon,
    ArchiveIcon,
    Loader2Icon,
    DownloadIcon,
    UploadIcon,
    UserPlusIcon,
    UserMinusIcon,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BulkImportModal } from '@/components/bulk-import-modal';
import { toast } from 'sonner';

// Types for the asset data passed from server
interface AssetImage {
    id: string;
}

interface AssetCategory {
    id: string;
    name: string;
}

interface AssignedUser {
    id: string;
    firstName: string;
    lastName: string | null;
}

interface Asset {
    id: string;
    name: string;
    serialNumber: string | null;
    assetTag: string | null;
    status: string;
    category: AssetCategory;
    assignedTo: AssignedUser | null;
    images: AssetImage[];
}

interface Category {
    id: string;
    name: string;
    icon: string | null;
}

interface User {
    id: string;
    firstName: string;
    lastName: string | null;
}

interface AssetsTableProps {
    assets: Asset[];
    tenantSlug: string;
    categories: Category[];
    users: User[];
    canManageAssets: boolean;
    showArchived?: boolean;
}

// Pending action state for confirmation dialog
interface PendingAction {
    action: string;
    status?: string;
    title: string;
    description: string;
}

const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-green-100 text-green-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    MAINTENANCE: 'bg-yellow-100 text-yellow-800',
    RETIRED: 'bg-zinc-100 text-zinc-800',
};

/**
 * Assets Table with Multi-Select and Bulk Actions
 */
export function AssetsTable({
    assets,
    tenantSlug,
    categories,
    users,
    canManageAssets,
    showArchived = false,
}: AssetsTableProps) {
    const router = useRouter();
    const canManageActiveAssets = canManageAssets && !showArchived;
    const canManageArchivedAssets = canManageAssets && showArchived;
    const canSelectAssets = canManageAssets;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    // Selection handlers
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === assets.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(assets.map(a => a.id)));
        }
    };

    const isAllSelected = assets.length > 0 && selectedIds.size === assets.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < assets.length;

    const successMessages: Record<string, string> = {
        update_status: 'Successfully updated',
        assign: 'Successfully assigned',
        unassign: 'Successfully unassigned',
        delete: 'Successfully archived',
        restore: 'Successfully restored',
    };

    // Execute bulk action (called after confirmation)
    const executeBulkAction = async (action: string, data?: Record<string, unknown>) => {
        if (selectedIds.size === 0) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/tenants/${tenantSlug}/assets/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    assetIds: Array.from(selectedIds),
                    data
                })
            });

            if (response.ok) {
                const result = await response.json();
                setSelectedIds(new Set());
                toast.success(`${successMessages[action] || 'Successfully updated'} ${result.count} asset(s)`);
                router.refresh();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Action failed');
            }
        } catch (error) {
            console.error('Bulk action failed:', error);
            toast.error('Failed to perform action. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Request confirmation before bulk action
    const requestStatusChange = (status: string) => {
        const statusLabels: Record<string, { title: string; description: string }> = {
            AVAILABLE: {
                title: 'Mark Assets as Available',
                description: 'This will mark the selected assets as available for assignment.'
            },
            MAINTENANCE: {
                title: 'Mark Assets for Maintenance',
                description: 'This will mark the selected assets as under maintenance. They will not be available for assignment.'
            },
            RETIRED: {
                title: 'Retire Assets',
                description: 'This will mark the selected assets as retired. They will no longer be active in your inventory.'
            }
        };

        setPendingAction({
            action: 'update_status',
            status,
            ...statusLabels[status]
        });
    };

    // Request unassign confirmation
    const requestUnassign = () => {
        setPendingAction({
            action: 'unassign',
            title: 'Unassign Assets',
            description: 'This will remove the assignment from the selected assets and mark them as available.'
        });
    };

    // Request archive confirmation. The API action is still named "delete" because
    // the backend treats delete as soft-delete/archive.
    const requestArchive = () => {
        setPendingAction({
            action: 'delete',
            title: 'Archive Assets',
            description: 'This will archive the selected assets and remove them from the active inventory list. Assigned assets cannot be archived - unassign them first.'
        });
    };

    // Request restore confirmation
    const requestRestore = () => {
        setPendingAction({
            action: 'restore',
            title: 'Restore Assets',
            description: 'This will restore the selected archived assets back into active inventory as available assets.'
        });
    };

    // Handle bulk assign
    const handleBulkAssign = async () => {
        if (!selectedUserId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/tenants/${tenantSlug}/assets/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    assetIds: Array.from(selectedIds),
                    data: { assignedToId: selectedUserId }
                })
            });

            if (response.ok) {
                const result = await response.json();
                setSelectedIds(new Set());
                setIsAssignModalOpen(false);
                setSelectedUserId('');
                toast.success(`Successfully assigned ${result.count} asset(s)`);
                router.refresh();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Assignment failed');
            }
        } catch (error) {
            console.error('Bulk assign failed:', error);
            toast.error('Failed to assign assets. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle CSV export (uses link click to avoid pop-up blockers)
    const handleExport = (exportAll: boolean = false) => {
        const url = exportAll
            ? `/api/tenants/${tenantSlug}/assets/export${showArchived ? '?archived=true' : ''}`
            : `/api/tenants/${tenantSlug}/assets/export?ids=${Array.from(selectedIds).join(',')}`;

        // Create temporary link and click it to trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = ''; // Browser will use Content-Disposition filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle confirmation
    const handleConfirm = async () => {
        if (!pendingAction) return;

        if (pendingAction.action === 'update_status') {
            await executeBulkAction(pendingAction.action, { status: pendingAction.status });
        } else {
            await executeBulkAction(pendingAction.action);
        }
        setPendingAction(null);
    };

    return (
        <>
            {/* Confirmation Dialog */}
            <AlertDialog
                open={canSelectAssets && !!pendingAction}
                onOpenChange={() => setPendingAction(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingAction?.description}
                            <br /><br />
                            <strong>{selectedIds.size} asset(s)</strong> will be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Confirm'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import Modal */}
            {canManageActiveAssets && (
                <BulkImportModal
                    tenantSlug={tenantSlug}
                    categories={categories}
                    open={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                />
            )}

            {/* Assign Modal */}
            <Dialog
                open={canManageActiveAssets && isAssignModalOpen}
                onOpenChange={(open) => {
                    setIsAssignModalOpen(open);
                    if (!open) setSelectedUserId('');
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign {selectedIds.size} Asset{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium">Select User</label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.firstName} {user.lastName || ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleBulkAssign} disabled={!selectedUserId || isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    Assigning...
                                </>
                            ) : (
                                'Assign to User'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                {/* Toolbar with Import button */}
                {canManageActiveAssets && (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setIsImportModalOpen(true)}
                        >
                            <UploadIcon className="mr-2 h-4 w-4" />
                            Import Assets
                        </Button>
                    </div>
                )}

                {/* Floating Action Bar - shown when items selected */}
                {canSelectAssets && selectedIds.size > 0 && (
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm dark:bg-zinc-900">
                        <span className="text-sm font-medium">
                            {selectedIds.size} asset{selectedIds.size > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex items-center gap-2">
                            {canManageActiveAssets ? (
                                <>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" disabled={isLoading}>
                                                {isLoading ? (
                                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <ChevronDownIcon className="mr-2 h-4 w-4" />
                                                )}
                                                Change Status
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => requestStatusChange('AVAILABLE')}>
                                                <CheckCircleIcon className="mr-2 h-4 w-4 text-green-600" />
                                                Mark Available
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => requestStatusChange('MAINTENANCE')}>
                                                <WrenchIcon className="mr-2 h-4 w-4 text-yellow-600" />
                                                Mark Maintenance
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => requestStatusChange('RETIRED')}>
                                                <ArchiveIcon className="mr-2 h-4 w-4 text-zinc-600" />
                                                Mark Retired
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isLoading}
                                        onClick={() => setIsAssignModalOpen(true)}
                                    >
                                        <UserPlusIcon className="mr-2 h-4 w-4" />
                                        Assign
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isLoading}
                                        onClick={requestUnassign}
                                    >
                                        <UserMinusIcon className="mr-2 h-4 w-4" />
                                        Unassign
                                    </Button>
                                </>
                            ) : canManageArchivedAssets ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={requestRestore}
                                >
                                    <RotateCcwIcon className="mr-2 h-4 w-4" />
                                    Restore
                                </Button>
                            ) : null}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={isLoading}>
                                        <DownloadIcon className="mr-2 h-4 w-4" />
                                        Export CSV
                                        <ChevronDownIcon className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleExport(false)}>
                                        Export Selected ({selectedIds.size})
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(true)}>
                                        Export All Assets
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {canManageActiveAssets && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={requestArchive}
                                    className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900 dark:text-orange-300 dark:hover:bg-orange-950"
                                >
                                    <ArchiveIcon className="mr-2 h-4 w-4" />
                                    Archive
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Clear Selection
                            </Button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-lg border bg-white dark:bg-zinc-950">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {canSelectAssets && (
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                )}
                                <TableHead className="w-16"></TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Serial / Tag</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assets.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={canSelectAssets ? 8 : 7}
                                        className="py-12 text-center"
                                    >
                                        <p className="text-zinc-500">No assets found</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                assets.map((asset) => {
                                    const primaryImage = asset.images[0];
                                    const isSelected = selectedIds.has(asset.id);

                                    return (
                                        <TableRow
                                            key={asset.id}
                                            className={
                                                canSelectAssets && isSelected
                                                    ? 'bg-violet-50 dark:bg-violet-950/20'
                                                    : ''
                                            }
                                        >
                                            {canSelectAssets && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelect(asset.id)}
                                                        aria-label={`Select ${asset.name}`}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="w-16 py-2">
                                                <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                    {primaryImage ? (
                                                        <Image
                                                            src={`/api/images/${primaryImage.id}/thumb`}
                                                            alt={asset.name}
                                                            fill
                                                            unoptimized
                                                            sizes="48px"
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <ImageIcon className="h-5 w-5 text-zinc-400" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{asset.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{asset.category.name}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-500">
                                                {asset.serialNumber || asset.assetTag || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColors[asset.status]}>
                                                    {asset.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {asset.assignedTo ? (
                                                    <span className="text-sm">
                                                        {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/t/${tenantSlug}/assets/${asset.id}`}>
                                                    <Button variant="ghost" size="sm">
                                                        <EyeIcon className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}
