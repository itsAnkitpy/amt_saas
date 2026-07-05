// Pure onboarding helpers — NO server-only imports (no Clerk, no db), so this
// module is safe to import from both Client and Server Components. The
// server-only routing lookup lives in ./onboarding-routing.ts.

/**
 * Slugs a self-serve workspace may never claim — they collide with top-level
 * app routes (/admin, /api, /t, ...). A Set gives O(1) lookup.
 */
export const RESERVED_SLUGS = new Set<string>([
    "admin",
    "api",
    "dashboard",
    "onboarding",
    "t",
    "sign-in",
    "sign-up",
    "webhooks",
]);

/** The routing DB row shape destinationForUser needs — kept minimal on purpose. */
export type RoutingUser = {
    isSuperAdmin: boolean;
    tenant: { slug: string } | null;
} | null;

/**
 * The pure routing decision behind resolveDestination — no I/O, so it can be
 * unit-tested directly (superadmin, tenant-less, invited-user-with-tenant, …).
 * A null user means "signed in but no DB row yet" (fresh signup) → onboarding.
 */
export function destinationForUser(user: RoutingUser): string {
    if (!user) {
        return "/onboarding";
    }
    if (user.isSuperAdmin) {
        return "/admin";
    }
    if (!user.tenant) {
        return "/onboarding";
    }
    // Tenant home is the dashboard sub-route — there is no page at bare /t/[slug].
    return `/t/${user.tenant.slug}/dashboard`;
}

/**
 * Turn a company name into a URL-safe slug candidate: lowercase, non-alphanumeric
 * runs collapse to a single hyphen, trimmed, max 50 chars. May return "" (e.g. the
 * name was all punctuation) — callers supply a fallback.
 */
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 50)
        .replace(/^-+|-+$/g, "");
}

/** True if a slug is reserved and must not be handed to a tenant. */
export function isReservedSlug(slug: string): boolean {
    return RESERVED_SLUGS.has(slug);
}

/**
 * Nth slug candidate for a base: attempt 0 is the base itself, then base-2,
 * base-3, … Used to walk past collisions and reserved names.
 */
export function slugCandidate(base: string, attempt: number): string {
    return attempt === 0 ? base : `${base}-${attempt + 1}`;
}
