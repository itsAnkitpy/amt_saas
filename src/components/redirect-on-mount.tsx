"use client";

import { useEffect } from "react";

/**
 * Forces a full-page navigation on mount.
 *
 * A server `redirect()` thrown from an RSC render during Clerk's client-side
 * after-sign-up navigation can leave the router stuck until a hard refresh.
 * Rendering this component instead (like a normal page body) and letting the
 * browser do a real navigation avoids that — it's the same "render a component"
 * path the self-serve onboarding form already uses successfully.
 */
export function RedirectOnMount({ to }: { to: string }) {
    useEffect(() => {
        window.location.replace(to);
    }, [to]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-zinc-500">Redirecting…</p>
        </div>
    );
}
