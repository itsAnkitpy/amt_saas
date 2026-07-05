"use server";

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
    createWorkspace,
    isSlugAvailable,
    type WorkspaceOwner,
} from "@/lib/workspace-service";

/** Resolve the signed-in Clerk user into the owner identity the service needs. */
async function currentOwner(): Promise<WorkspaceOwner | null> {
    const user = await currentUser();
    if (!user) {
        return null;
    }
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return null;
    }
    return {
        userId: user.id,
        email,
        firstName: user.firstName || "User",
        lastName: user.lastName || null,
    };
}

/**
 * Create the signed-in user's workspace, then send them into it. Returns an
 * error for the form to display; on success it redirects (which throws), so no
 * value comes back — mirrors the createAsset action pattern.
 */
export async function createWorkspaceAction(
    formData: FormData
): Promise<{ error?: string }> {
    const owner = await currentOwner();
    if (!owner) {
        return { error: "You must be signed in to create a workspace." };
    }

    const result = await createWorkspace(owner, {
        name: (formData.get("name") as string | null) ?? "",
        slug: (formData.get("slug") as string | null) ?? undefined,
    });
    if (!result.ok) {
        return { error: result.error };
    }

    redirect(`/t/${result.slug}/dashboard`);
}

/** Live availability check for the onboarding form's slug field. */
export async function checkSlugAvailabilityAction(rawSlug: string) {
    return isSlugAvailable(rawSlug);
}
