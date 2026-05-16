"use client";

import { useState, useTransition } from "react";
import {
    AlertTriangleIcon,
    ClockIcon,
    ShieldAlertIcon,
    UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateNotificationPreferencesAction } from "@/app/t/[slug]/notifications/preferences/actions";
import type {
    NotificationPreferenceItem,
    NotificationTypeValue,
} from "@/lib/validations/notification";

type EventTypeMeta = {
    key: NotificationTypeValue;
    label: string;
    description: string;
    icon: typeof AlertTriangleIcon;
    iconClass: string;
};

const EVENT_TYPES: ReadonlyArray<EventTypeMeta> = [
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

type PrefRow = { inApp: boolean; email: boolean };
type PrefState = Record<NotificationTypeValue, PrefRow>;

export type NotificationPreferencesFormProps = {
    slug: string;
    initialPreferences: NotificationPreferenceItem[];
};

function buildInitialState(initial: NotificationPreferenceItem[]): PrefState {
    const byType = new Map(initial.map((p) => [p.type, p]));
    return EVENT_TYPES.reduce((acc, t) => {
        const row = byType.get(t.key);
        acc[t.key] = {
            inApp: row?.inApp ?? true,
            email: row?.email ?? true,
        };
        return acc;
    }, {} as PrefState);
}

export function NotificationPreferencesForm({
    slug,
    initialPreferences,
}: NotificationPreferencesFormProps) {
    const [state, setState] = useState<PrefState>(() => buildInitialState(initialPreferences));
    const [isPending, startTransition] = useTransition();

    const toggle = (key: NotificationTypeValue, channel: keyof PrefRow) => {
        setState((prev) => ({
            ...prev,
            [key]: { ...prev[key], [channel]: !prev[key][channel] },
        }));
    };

    const handleSave = () => {
        const payload = {
            preferences: EVENT_TYPES.map((t) => ({
                type: t.key,
                inApp: state[t.key].inApp,
                email: state[t.key].email,
            })),
        };

        startTransition(async () => {
            const result = await updateNotificationPreferencesAction(slug, payload);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Notification preferences saved");
        });
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Event</span>
                    <span className="w-16 text-center">In-app</span>
                    <span className="w-16 text-center">Email</span>
                </div>
                <ul className="divide-y">
                    {EVENT_TYPES.map((t) => {
                        const Icon = t.icon;
                        const row = state[t.key];
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
                                <div className="flex w-16 justify-center">
                                    <Checkbox
                                        aria-label={`${t.label} in-app`}
                                        checked={row.inApp}
                                        onCheckedChange={() => toggle(t.key, "inApp")}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="flex w-16 justify-center">
                                    <Checkbox
                                        aria-label={`${t.label} email`}
                                        checked={row.email}
                                        onCheckedChange={() => toggle(t.key, "email")}
                                        disabled={isPending}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving…" : "Save preferences"}
                </Button>
            </div>
        </div>
    );
}
