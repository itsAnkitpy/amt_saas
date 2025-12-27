import { requireTenantAccess } from "@/lib/auth";
import { ActivityDashboard } from "./activity-dashboard";

interface ActivityPageProps {
    params: Promise<{ slug: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
    const { slug } = await params;
    await requireTenantAccess(slug);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Activity Log</h1>
                <p className="text-muted-foreground">
                    Recent activity across all assets
                </p>
            </div>

            <ActivityDashboard tenantSlug={slug} />
        </div>
    );
}
