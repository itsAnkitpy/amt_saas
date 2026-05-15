import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
    AlertTriangleIcon,
    BellIcon,
    CheckCheckIcon,
    ClockIcon,
    SettingsIcon,
    ShieldAlertIcon,
    UserPlusIcon,
} from "lucide-react";
import { requireTenantAccess } from "@/lib/auth";
import {
    getUnreadCount,
    listNotificationsForUser,
} from "@/lib/notification-service";
import type { NotificationType } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import {
    dismissAction,
    markAllAsReadAction,
    markAsReadAction,
} from "./actions";

interface NotificationsPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ filter?: string }>;
}

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

export default async function NotificationsPage({
    params,
    searchParams,
}: NotificationsPageProps) {
    const { slug } = await params;
    const { filter } = await searchParams;
    const { user, tenant } = await requireTenantAccess(slug);

    const unreadOnly = filter === "unread";
    const [page, unreadCount] = await Promise.all([
        listNotificationsForUser(user.id, tenant.id, { unreadOnly, limit: 50 }),
        getUnreadCount(user.id, tenant.id),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Notifications</h1>
                    <p className="text-muted-foreground">
                        {unreadCount === 0
                            ? "You're all caught up."
                            : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`}
                    </p>
                </div>
                <Link
                    href={`/t/${slug}/notifications/preferences`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <SettingsIcon className="h-4 w-4" />
                    Preferences
                </Link>
            </div>

            <div className="flex items-center justify-between gap-3 border-b pb-3">
                <div className="flex gap-2">
                    <FilterPill
                        href={`/t/${slug}/notifications`}
                        active={!unreadOnly}
                        label="All"
                    />
                    <FilterPill
                        href={`/t/${slug}/notifications?filter=unread`}
                        active={unreadOnly}
                        label={`Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                    />
                </div>
                {unreadCount > 0 && (
                    <form action={markAllAsReadAction.bind(null, slug)}>
                        <Button variant="outline" size="sm" type="submit">
                            <CheckCheckIcon className="mr-1.5 h-4 w-4" />
                            Mark all as read
                        </Button>
                    </form>
                )}
            </div>

            {page.items.length === 0 ? (
                <div className="rounded-lg border border-dashed py-16 text-center">
                    <BellIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground">
                        {unreadOnly ? "No unread notifications." : "No notifications yet."}
                    </p>
                </div>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {page.items.map((n) => {
                        const Icon = TYPE_ICON[n.type];
                        const isUnread = n.readAt === null;
                        return (
                            <li
                                key={n.id}
                                className={`flex items-start gap-4 px-4 py-4 ${
                                    isUnread ? "bg-muted/30" : ""
                                }`}
                            >
                                <Icon
                                    className={`mt-0.5 h-5 w-5 shrink-0 ${TYPE_COLOR[n.type]}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p
                                            className={`truncate ${
                                                isUnread ? "font-semibold" : "font-medium"
                                            }`}
                                        >
                                            {n.title}
                                        </p>
                                        {isUnread && (
                                            <span
                                                aria-label="Unread"
                                                className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                                            />
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        {n.body}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatDistanceToNow(n.createdAt, {
                                            addSuffix: true,
                                        })}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {isUnread && (
                                        <form
                                            action={markAsReadAction.bind(null, slug, n.id)}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                type="submit"
                                            >
                                                Mark read
                                            </Button>
                                        </form>
                                    )}
                                    <form action={dismissAction.bind(null, slug, n.id)}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="submit"
                                        >
                                            Dismiss
                                        </Button>
                                    </form>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function FilterPill({
    href,
    active,
    label,
}: {
    href: string;
    active: boolean;
    label: string;
}) {
    return (
        <Link
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
        >
            {label}
        </Link>
    );
}
