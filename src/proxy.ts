import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes are public (no login needed)
const isPublicRoute = createRouteMatcher([
    "/",                    // Home page
    "/sign-in(.*)",         // Sign in pages
    "/sign-up(.*)",         // Sign up pages
    "/api/webhooks(.*)",    // Webhooks (for Clerk sync)
]);

export default clerkMiddleware(async (auth, req) => {
    // If trying to access protected route without login, redirect to sign-in
    if (!isPublicRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
