import Link from "next/link";
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    ClockIcon,
    ShieldAlertIcon,
    UserPlusIcon,
} from "lucide-react";
import { requireTenantAccess } from "@/lib/auth";

interface PreferencesPageProps {
    params: Promise<{ slug: string }>;
}

const EVENT_TYPES = [
    {
        key: "MAINTENANCE_OVERDUE",
        label: "Maintenance overdue",
        description: "An asset's maintenance job is past its due date.",
        icon: AlertTriangleIcon,
        iconClass: "text-red-600",
    },
    {
        key: "MAINTENANCE_DUE_SOON",
        label: "Maintenance due soon",
        description: "An asset's maintenance is due within the next 7 days.",
        icon: ClockIcon,
        iconClass: "text-yellow-600",
    },
    {
        key: "WARRANTY_EXPIRING",
        label: "Warranty expiring",
        description: "An asset's warranty ends within the next 30 days.",
        icon: ShieldAlertIcon,
        iconClass: "text-orange-600",
    },
    {
        key: "ASSET_ASSIGNED_TO_YOU",
        label: "Asset assigned to you",
        description: "An admin or manager has assigned an asset to you.",
        icon: UserPlusIcon,
        iconClass: "text-blue-600",
    },
];

export default async function NotificationPreferencesPage({
    params,
}: PreferencesPageProps) {
    const { slug } = await params;
    await requireTenantAccess(slug);

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href={`/t/${slug}/notifications`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to notifications
                </Link>
                <h1 className="mt-2 text-2xl font-bold">Notification preferences</h1>
                <p className="text-muted-foreground">
                    Choose which notifications you want to receive in-app and by email.
                </p>
            </div>

            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-medium">Coming soon</p>
                <p className="text-muted-foreground">
                    Per-channel toggles will activate in a future release alongside
                    email delivery. For now, all notifications appear in your inbox.
                </p>
            </div>

            <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Event</span>
                    <span className="w-16 text-center">In-app</span>
                    <span className="w-16 text-center">Email</span>
                </div>
                <ul className="divide-y">
                    {EVENT_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                            <li
                                key={t.key}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3"
                            >
                                <div className="flex items-start gap-3">
                                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.iconClass}`} />
                                    <div>
                                        <p className="font-medium">{t.label}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {t.description}
                                        </p>
                                    </div>
                                </div>
                                <span className="w-16 text-center text-sm text-muted-foreground">
                                    On
                                </span>
                                <span className="w-16 text-center text-sm text-muted-foreground">
                                    On
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
