"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/auth";
import { inviteToTenant, revokeInvitation } from "@/lib/invitation-service";
import type { Role } from "@/generated/prisma";

/**
 * Only a workspace ADMIN (or a superadmin) may invite. requireTenantAccess lets
 * any member of the tenant through, so the role is gated here (M5).
 */
function canManageInvites(user: { role: string; isSuperAdmin: boolean }): boolean {
    return user.isSuperAdmin || user.role === "ADMIN";
}

/**
 * The client door: invite a teammate into the caller's OWN workspace. The
 * tenant is derived from the URL-checked access, never from the form, so an
 * ADMIN of one workspace physically cannot invite into another (M5). Returns an
 * error string for the form to show; on success returns the invited email.
 */
export async function inviteTeammateAction(
    slug: string,
    formData: FormData
): Promise<{ error?: string; email?: string }> {
    const { user, tenant } = await requireTenantAccess(slug);
    if (!canManageInvites(user)) {
        return { error: "Only workspace admins can invite teammates." };
    }

    const email = ((formData.get("email") as string | null) ?? "").trim();
    const role = ((formData.get("role") as string | null) ?? "USER") as Role;

    const result = await inviteToTenant({
        tenantId: tenant.id, // forced from the resolved tenant — never the form
        email,
        role,
        invitedById: user.id,
    });
    if (!result.ok) {
        return { error: result.error };
    }

    revalidatePath(`/t/${slug}/users`);
    return { email: result.invitation.email };
}

/**
 * Revoke a pending invite from the caller's own workspace. Scoped by tenant in
 * the service, and gated to admins here. Runs as a form action (returns void).
 */
export async function revokeInvitationAction(
    slug: string,
    invitationId: string
): Promise<void> {
    const { user, tenant } = await requireTenantAccess(slug);
    if (!canManageInvites(user)) {
        return;
    }

    await revokeInvitation(invitationId, tenant.id);
    revalidatePath(`/t/${slug}/users`);
}
