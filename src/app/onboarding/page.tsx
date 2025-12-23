import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    // For now, just redirect to dashboard
    // TODO: Later we'll add organization creation here
    redirect("/dashboard");
}
