import {
    PlusCircle,
    Pencil,
    Archive,
    UserPlus,
    UserMinus,
    RefreshCw,
    RotateCcw,
    ImagePlus,
    ImageMinus,
    ChevronRight,
    type LucideIcon,
    CalendarClock,
    PlayCircle,
    CircleCheckBig,
    Ban,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { formatActivityDetails, getActivityActionLabel } from '@/lib/activity-format';

// Activity action icons and colors - matching existing activity-timeline.tsx
const ACTION_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
    CREATED: { icon: PlusCircle, color: 'text-green-600', label: getActivityActionLabel('CREATED') },
    UPDATED: { icon: Pencil, color: 'text-blue-600', label: getActivityActionLabel('UPDATED') },
    DELETED: { icon: Archive, color: 'text-orange-600', label: getActivityActionLabel('DELETED') },
    RESTORED: { icon: RotateCcw, color: 'text-green-600', label: getActivityActionLabel('RESTORED') },
    ASSIGNED: { icon: UserPlus, color: 'text-violet-600', label: getActivityActionLabel('ASSIGNED') },
    UNASSIGNED: { icon: UserMinus, color: 'text-orange-600', label: getActivityActionLabel('UNASSIGNED') },
    STATUS_CHANGED: { icon: RefreshCw, color: 'text-yellow-600', label: getActivityActionLabel('STATUS_CHANGED') },
    IMAGE_ADDED: { icon: ImagePlus, color: 'text-blue-500', label: getActivityActionLabel('IMAGE_ADDED') },
    IMAGE_REMOVED: { icon: ImageMinus, color: 'text-zinc-500', label: getActivityActionLabel('IMAGE_REMOVED') },
    MAINTENANCE_SCHEDULED: { icon: CalendarClock, color: 'text-violet-600', label: 'scheduled maintenance for' },
    MAINTENANCE_UPDATED: { icon: Pencil, color: 'text-blue-600', label: 'updated maintenance for' },
    MAINTENANCE_DISABLED: { icon: Ban, color: 'text-zinc-500', label: 'disabled maintenance for' },
    MAINTENANCE_STARTED: { icon: PlayCircle, color: 'text-amber-600', label: 'started maintenance on' },
    MAINTENANCE_COMPLETED: { icon: CircleCheckBig, color: 'text-green-600', label: 'completed maintenance on' },
    MAINTENANCE_CANCELLED: { icon: Ban, color: 'text-red-600', label: 'cancelled maintenance for' },
};

interface Activity {
    id: string;
    action: string;
    createdAt: Date;
    details: Record<string, unknown> | null;
    asset: {
        id: string;
        name: string;
    } | null;
}

interface RecentActivityProps {
    activities: Activity[];
    tenantSlug: string;
}

/**
 * Recent Activity Component
 * 
 * Displays a timeline of recent asset activities.
 * Shows the last 5 activities with a link to view all.
 */
export function RecentActivity({ activities, tenantSlug }: RecentActivityProps) {
    // Empty state
    if (activities.length === 0) {
        return (
            <div className="flex h-48 flex-col items-center justify-center text-center">
                <div className="rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
                    <Pencil className="h-6 w-6 text-zinc-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">
                    No recent activity
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                    Asset changes will appear here
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Activity Timeline */}
            <div className="space-y-4">
                {activities.map((activity) => {
                    const config = ACTION_CONFIG[activity.action] || {
                        icon: Pencil,
                        color: 'text-zinc-500',
                        label: activity.action.toLowerCase().replace('_', ' '),
                    };
                    const Icon = config.icon;
                    const details = activity.details as Record<string, unknown> | null;
                    // Use performedBy from details (matching existing activity-timeline)
                    const performedBy = (details?.performedBy as string) || 'System';
                    const additionalInfo = formatActivityDetails(activity.action, details);

                    return (
                        <div key={activity.id} className="flex gap-3">
                            {/* Icon */}
                            <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
                                <Icon className="h-4 w-4" />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-900 dark:text-white">
                                    <span className="font-medium">{performedBy}</span>{' '}
                                    {config.label}{' '}
                                    {activity.asset ? (
                                        <Link
                                            href={`/t/${tenantSlug}/assets/${activity.asset.id}`}
                                            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                                        >
                                            {activity.asset.name}
                                        </Link>
                                    ) : (
                                        <span className="text-zinc-500">(deleted asset)</span>
                                    )}
                                    {additionalInfo && (
                                        <span className="text-zinc-500"> {additionalInfo}</span>
                                    )}
                                </p>
                                <p className="mt-0.5 text-xs text-zinc-500">
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* View All Link */}
            <Link
                href={`/t/${tenantSlug}/activity`}
                className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
                View all activity
                <ChevronRight className="h-4 w-4" />
            </Link>
        </div>
    );
}
