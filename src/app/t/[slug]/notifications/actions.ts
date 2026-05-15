"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/auth";
import {
    dismissNotification,
    markAllAsRead,
    markAsRead,
} from "@/lib/notification-service";

export async function markAsReadAction(slug: string, notificationId: string) {
    const { user } = await requireTenantAccess(slug);
    await markAsRead(notificationId, user.id);
    revalidatePath(`/t/${slug}/notifications`);
    revalidatePath(`/t/${slug}`, "layout");
}

export async function markAllAsReadAction(slug: string) {
    const { user, tenant } = await requireTenantAccess(slug);
    await markAllAsRead(user.id, tenant.id);
    revalidatePath(`/t/${slug}/notifications`);
    revalidatePath(`/t/${slug}`, "layout");
}

export async function dismissAction(slug: string, notificationId: string) {
    const { user } = await requireTenantAccess(slug);
    await dismissNotification(notificationId, user.id);
    revalidatePath(`/t/${slug}/notifications`);
    revalidatePath(`/t/${slug}`, "layout");
}
