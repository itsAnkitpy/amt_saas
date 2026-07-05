import { redirect } from "next/navigation";
import { resolveDestination } from "@/lib/onboarding-routing";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
    // Anyone who already has a home (superadmin, or a user with a workspace) is
    // sent there. Only fresh / tenant-less signups stay to onboard.
    const destination = await resolveDestination();
    if (destination !== "/onboarding") {
        redirect(destination);
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
