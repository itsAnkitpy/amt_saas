import { redirect } from "next/navigation";
import { resolveDestination } from "@/lib/onboarding-routing";

/**
 * /dashboard is a pure router: it forwards each signed-in user to their real
 * home — their workspace (/t/[slug]/dashboard), the admin area, or onboarding.
 * It renders nothing, so no internal identifiers are ever shown to a client.
 */
export default async function DashboardPage() {
    redirect(await resolveDestination());
}
