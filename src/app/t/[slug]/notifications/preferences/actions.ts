"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    NotificationPreferencesSchema,
    type NotificationPreferencesInput,
} from "@/lib/validations/notification";

/**
 * Upserts the current user's full preferences grid (4 event types × 2 channels)
 * in a single transaction. Atomic save = no partial states.
 *
 * Auth: `requireTenantAccess` only (no role gate — every user manages their
 * own prefs per PRD §8.3).
 */
export async function updateNotificationPreferencesAction(
    slug: string,
    input: NotificationPreferencesInput,
): Promise<{ error?: string }> {
    const parsed = NotificationPreferencesSchema.safeParse(input);
    if (!parsed.success) {
        return { error: "Invalid preferences payload" };
    }

    const { user, tenant } = await requireTenantAccess(slug);

    await db.$transaction(
        parsed.data.preferences.map((p) =>
            db.notificationPreference.upsert({
                where: {
                    tenantId_userId_type: {
                        tenantId: tenant.id,
                        userId: user.id,
                        type: p.type,
                    },
                },
                create: {
                    tenantId: tenant.id,
                    userId: user.id,
                    type: p.type,
                    inApp: p.inApp,
                    email: p.email,
                },
                update: {
                    inApp: p.inApp,
                    email: p.email,
                },
            }),
        ),
    );

    revalidatePath(`/t/${slug}/notifications/preferences`);
    return {};
}
