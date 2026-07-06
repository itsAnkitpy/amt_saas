import { resolveDestination } from "@/lib/onboarding-routing";
import { RedirectOnMount } from "@/components/redirect-on-mount";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
    // Anyone who already has a home (superadmin, a user with a workspace, or an
    // invited teammate whose invite was just claimed) is sent there. Only fresh /
    // tenant-less signups stay to onboard.
    //
    // We RENDER a client redirect rather than throwing next/navigation's
    // redirect(): a server redirect() during Clerk's post-sign-up client-side
    // navigation can hang the router until a hard refresh (see RedirectOnMount).
    const destination = await resolveDestination();
    if (destination !== "/onboarding") {
        return <RedirectOnMount to={destination} />;
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
            <h1 className="text-2xl font-bold">Set up your workspace</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Give your organization a name to get started.
            </p>
            <OnboardingForm />
        </main>
    );
}
