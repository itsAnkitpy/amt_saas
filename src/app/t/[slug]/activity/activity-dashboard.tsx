'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
    PlusCircleIcon,
    PencilIcon,
    UserPlusIcon,
    UserMinusIcon,
    RefreshCwIcon,
    ArchiveIcon,
    RotateCcwIcon,
    ImagePlusIcon,
    ImageMinusIcon,
    Loader2Icon,
    AlertCircleIcon,
    FilterIcon,
    CalendarClockIcon,
    PlayCircleIcon,
    CircleCheckBigIcon,
    BanIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatActivityDetails, getActivityActionLabel } from '@/lib/activity-format';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Activity {
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
    asset: {
        id: string;
        name: string;
        assetTag: string | null;
    };
}

interface ActivityDashboardProps {
    tenantSlug: string;
}

const actionConfig: Record<string, { icon: typeof PlusCircleIcon; label: string; color: string }> = {
    CREATED: { icon: PlusCircleIcon, label: getActivityActionLabel('CREATED'), color: 'text-green-600' },
    UPDATED: { icon: PencilIcon, label: getActivityActionLabel('UPDATED'), color: 'text-blue-600' },
    ASSIGNED: { icon: UserPlusIcon, label: getActivityActionLabel('ASSIGNED'), color: 'text-violet-600' },
    UNASSIGNED: { icon: UserMinusIcon, label: getActivityActionLabel('UNASSIGNED'), color: 'text-orange-600' },
    STATUS_CHANGED: { icon: RefreshCwIcon, label: getActivityActionLabel('STATUS_CHANGED'), color: 'text-yellow-600' },
    DELETED: { icon: ArchiveIcon, label: getActivityActionLabel('DELETED'), color: 'text-orange-600' },
    RESTORED: { icon: RotateCcwIcon, label: getActivityActionLabel('RESTORED'), color: 'text-green-600' },
    IMAGE_ADDED: { icon: ImagePlusIcon, label: getActivityActionLabel('IMAGE_ADDED'), color: 'text-blue-500' },
    IMAGE_REMOVED: { icon: ImageMinusIcon, label: getActivityActionLabel('IMAGE_REMOVED'), color: 'text-zinc-500' },
    MAINTENANCE_SCHEDULED: { icon: CalendarClockIcon, label: getActivityActionLabel('MAINTENANCE_SCHEDULED'), color: 'text-violet-600' },
    MAINTENANCE_UPDATED: { icon: PencilIcon, label: getActivityActionLabel('MAINTENANCE_UPDATED'), color: 'text-blue-600' },
    MAINTENANCE_DISABLED: { icon: BanIcon, label: getActivityActionLabel('MAINTENANCE_DISABLED'), color: 'text-zinc-500' },
    MAINTENANCE_STARTED: { icon: PlayCircleIcon, label: getActivityActionLabel('MAINTENANCE_STARTED'), color: 'text-amber-600' },
    MAINTENANCE_COMPLETED: { icon: CircleCheckBigIcon, label: getActivityActionLabel('MAINTENANCE_COMPLETED'), color: 'text-green-600' },
    MAINTENANCE_CANCELLED: { icon: BanIcon, label: getActivityActionLabel('MAINTENANCE_CANCELLED'), color: 'text-red-600' },
};

const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'CREATED', label: getActivityActionLabel('CREATED', 'title') },
    { value: 'UPDATED', label: getActivityActionLabel('UPDATED', 'title') },
    { value: 'ASSIGNED', label: getActivityActionLabel('ASSIGNED', 'title') },
    { value: 'UNASSIGNED', label: getActivityActionLabel('UNASSIGNED', 'title') },
    { value: 'STATUS_CHANGED', label: getActivityActionLabel('STATUS_CHANGED', 'title') },
    { value: 'DELETED', label: getActivityActionLabel('DELETED', 'title') },
    { value: 'RESTORED', label: getActivityActionLabel('RESTORED', 'title') },
    { value: 'IMAGE_ADDED', label: getActivityActionLabel('IMAGE_ADDED', 'title') },
    { value: 'IMAGE_REMOVED', label: getActivityActionLabel('IMAGE_REMOVED', 'title') },
    { value: 'MAINTENANCE_SCHEDULED', label: getActivityActionLabel('MAINTENANCE_SCHEDULED', 'title') },
    { value: 'MAINTENANCE_UPDATED', label: getActivityActionLabel('MAINTENANCE_UPDATED', 'title') },
    { value: 'MAINTENANCE_DISABLED', label: getActivityActionLabel('MAINTENANCE_DISABLED', 'title') },
    { value: 'MAINTENANCE_STARTED', label: getActivityActionLabel('MAINTENANCE_STARTED', 'title') },
    { value: 'MAINTENANCE_COMPLETED', label: getActivityActionLabel('MAINTENANCE_COMPLETED', 'title') },
    { value: 'MAINTENANCE_CANCELLED', label: getActivityActionLabel('MAINTENANCE_CANCELLED', 'title') },
];

export function ActivityDashboard({ tenantSlug }: ActivityDashboardProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [actionFilter, setActionFilter] = useState('all');

    const fetchActivities = useCallback(async (pageNum: number, action: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const actionParam = action !== 'all' ? `&action=${action}` : '';
            const res = await fetch(
                `/api/tenants/${tenantSlug}/activity?page=${pageNum}&pageSize=25${actionParam}`
            );

            if (!res.ok) {
                throw new Error('Failed to load activities');
            }

            const data = await res.json();
            setActivities(data.activities);
            setTotalPages(data.totalPages);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Failed to load activity history');
        } finally {
            setIsLoading(false);
        }
    }, [tenantSlug]);

    useEffect(() => {
        fetchActivities(page, actionFilter);
    }, [fetchActivities, page, actionFilter]);

    const handleFilterChange = (value: string) => {
        setActionFilter(value);
        setPage(1); // Reset to first page when filter changes
    };

    if (error && activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircleIcon className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-muted-foreground">{error}</p>
                <Button variant="ghost" onClick={() => fetchActivities(1, actionFilter)} className="mt-3">
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <Select value={actionFilter} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent>
                        {actionTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isLoading && <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Activity List */}
            <div className="rounded-lg border bg-white dark:bg-zinc-950">
                {activities.length === 0 && !isLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                        No activity found
                    </div>
                ) : (
                    <div className="divide-y">
                        {activities.map((activity) => {
                            const config = actionConfig[activity.action] || actionConfig.UPDATED;
                            const Icon = config.icon;
                            const details = activity.details as Record<string, unknown> | null;

                            return (
                                <div key={activity.id} className="flex items-start gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                    <div className={`mt-0.5 ${config.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                {details?.performedBy as string || 'System'}
                                            </span>
                                            {' '}
                                            {config.label}
                                            {' '}
                                            <Link
                                                href={`/t/${tenantSlug}/assets/${activity.asset.id}`}
                                                className="font-medium text-blue-600 hover:underline"
                                            >
                                                {activity.asset.name}
                                                {activity.asset.assetTag && ` (${activity.asset.assetTag})`}
                                            </Link>
                                            {' '}
                                            <span className="text-muted-foreground">
                                                {formatActivityDetails(activity.action, details)}
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p - 1)}
                            disabled={page === 1 || isLoading}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= totalPages || isLoading}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
