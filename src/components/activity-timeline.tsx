'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    PlusCircleIcon,
    PencilIcon,
    UserPlusIcon,
    UserMinusIcon,
    RefreshCwIcon,
    TrashIcon,
    RotateCcwIcon,
    ImagePlusIcon,
    ImageMinusIcon,
    Loader2Icon,
    AlertCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Activity {
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
}

interface ActivityTimelineProps {
    assetId: string;
    tenantSlug: string;
}

const actionConfig: Record<string, { icon: typeof PlusCircleIcon; label: string; color: string }> = {
    CREATED: { icon: PlusCircleIcon, label: 'Created', color: 'text-green-600' },
    UPDATED: { icon: PencilIcon, label: 'Updated', color: 'text-blue-600' },
    ASSIGNED: { icon: UserPlusIcon, label: 'Assigned', color: 'text-violet-600' },
    UNASSIGNED: { icon: UserMinusIcon, label: 'Unassigned', color: 'text-orange-600' },
    STATUS_CHANGED: { icon: RefreshCwIcon, label: 'Status changed', color: 'text-yellow-600' },
    DELETED: { icon: TrashIcon, label: 'Deleted', color: 'text-red-600' },
    RESTORED: { icon: RotateCcwIcon, label: 'Restored', color: 'text-green-600' },
    IMAGE_ADDED: { icon: ImagePlusIcon, label: 'Image added', color: 'text-blue-500' },
    IMAGE_REMOVED: { icon: ImageMinusIcon, label: 'Image removed', color: 'text-zinc-500' },
};

export function ActivityTimeline({ assetId, tenantSlug }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchActivities = useCallback(async (pageNum: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/tenants/${tenantSlug}/assets/${assetId}/activity?page=${pageNum}`
            );

            if (!res.ok) {
                throw new Error('Failed to load activities');
            }

            const data = await res.json();

            if (pageNum === 1) {
                setActivities(data.activities);
            } else {
                setActivities(prev => [...prev, ...data.activities]);
            }
            setHasMore(pageNum < data.totalPages);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Failed to load activity history');
        } finally {
            setIsLoading(false);
        }
    }, [assetId, tenantSlug]);

    useEffect(() => {
        fetchActivities(1);
    }, [fetchActivities]);

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchActivities(nextPage);
    };

    const formatDetails = (action: string, details: Record<string, unknown> | null) => {
        if (!details) return '';

        switch (action) {
            case 'ASSIGNED':
                return `to ${details.assignedTo}`;
            case 'UNASSIGNED':
                return details.previousAssignee ? `from ${details.previousAssignee}` : '';
            case 'STATUS_CHANGED':
                return details.to ? `to ${details.to}` : '';
            case 'UPDATED':
                return details.fields ? `(${(details.fields as string[]).join(', ')})` : '';
            case 'IMAGE_ADDED':
            case 'IMAGE_REMOVED':
                return details.fileName as string;
            case 'CREATED':
                return details.category ? `in ${details.category}` : '';
            default:
                return '';
        }
    };

    if (isLoading && activities.length === 0) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error && activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircleIcon className="h-6 w-6 text-red-500 mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="ghost" size="sm" onClick={() => fetchActivities(1)} className="mt-2">
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Activity</h3>

            <div className="space-y-3">
                {activities.map((activity) => {
                    const config = actionConfig[activity.action] || actionConfig.UPDATED;
                    const Icon = config.icon;
                    const details = activity.details as Record<string, unknown> | null;

                    return (
                        <div key={activity.id} className="flex items-start gap-3">
                            <div className={`mt-0.5 ${config.color}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                    <span className="font-medium">
                                        {details?.performedBy as string || 'System'}
                                    </span>
                                    {' '}
                                    {config.label.toLowerCase()}
                                    {' '}
                                    <span className="text-muted-foreground">
                                        {formatDetails(activity.action, details)}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasMore && (
                <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load more'}
                </Button>
            )}

            {activities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No activity recorded yet
                </p>
            )}
        </div>
    );
}
