"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
    AlertTriangleIcon,
    BellIcon,
    ClockIcon,
    ShieldAlertIcon,
    UserPlusIcon,
} from "lucide-react";
import type { Notification, NotificationType } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
    MAINTENANCE_OVERDUE: AlertTriangleIcon,
    MAINTENANCE_DUE_SOON: ClockIcon,
    WARRANTY_EXPIRING: ShieldAlertIcon,
    ASSET_ASSIGNED_TO_YOU: UserPlusIcon,
};

const TYPE_COLOR: Record<NotificationType, string> = {
    MAINTENANCE_OVERDUE: "text-red-600",
    MAINTENANCE_DUE_SOON: "text-yellow-600",
    WARRANTY_EXPIRING: "text-orange-600",
    ASSET_ASSIGNED_TO_YOU: "text-blue-600",
};

export type BellPreview = Pick<
    Notification,
    "id" | "type" | "title" | "body" | "createdAt"
>;

interface NotificationBellProps {
    slug: string;
    unreadCount: number;
    previews: BellPreview[];
}

export function NotificationBell({ slug, unreadCount, previews }: NotificationBellProps) {
    const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                        unreadCount > 0
                            ? `Notifications (${unreadCount} unread)`
                            : "Notifications"
                    }
                    className="relative"
                >
                    <BellIcon className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span
                            className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white"
                            aria-hidden="true"
                        >
                            {badgeLabel}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-semibold">Notifications</p>
                    <Link
                        href={`/t/${slug}/notifications/preferences`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Preferences
                    </Link>
                </div>

                {previews.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        You&apos;re all caught up.
                    </div>
                ) : (
                    <ul className="max-h-80 divide-y overflow-y-auto">
                        {previews.map((n) => {
                            const Icon = TYPE_ICON[n.type];
                            return (
                                <li key={n.id}>
                                    <Link
                                        href={`/t/${slug}/notifications`}
                                        className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted"
                                    >
                                        <Icon
                                            className={`mt-0.5 h-4 w-4 shrink-0 ${TYPE_COLOR[n.type]}`}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {n.title}
                                            </p>
                                            <p className="line-clamp-2 text-xs text-muted-foreground">
                                                {n.body}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                {formatDistanceToNow(n.createdAt, {
                                                    addSuffix: true,
                                                })}
                                            </p>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <Link
                    href={`/t/${slug}/notifications`}
                    className="block border-t px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted"
                >
                    View all
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
