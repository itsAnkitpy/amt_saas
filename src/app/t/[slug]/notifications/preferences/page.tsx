import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import type { NotificationPreferenceItem } from "@/lib/validations/notification";

interface PreferencesPageProps {
    params: Promise<{ slug: string }>;
}

export default async function NotificationPreferencesPage({
    params,
}: PreferencesPageProps) {
    const { slug } = await params;
    const { user, tenant } = await requireTenantAccess(slug);

    const rows = await db.notificationPreference.findMany({
        where: { tenantId: tenant.id, userId: user.id },
        select: { type: true, inApp: true, email: true },
    });

    const initialPreferences: NotificationPreferenceItem[] = rows.map((r) => ({
        type: r.type,
        inApp: r.inApp,
        email: r.email,
    }));

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
                    Email notifications arrive as a once-daily digest.
                </p>
            </div>

            <NotificationPreferencesForm
                slug={slug}
                initialPreferences={initialPreferences}
            />
        </div>
    );
}
