import { Loader2Icon } from "lucide-react";

/**
 * Shown while /dashboard resolves where to send the user (Clerk + DB lookup),
 * so the redirect never flashes a blank screen.
 */
export default function DashboardLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <Loader2Icon className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
    );
}
