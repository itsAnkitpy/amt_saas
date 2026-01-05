import { requireTenantAccess } from "@/lib/auth";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import {
    SidebarProvider,
    SidebarTrigger,
    SidebarInset,
} from "@/components/ui/sidebar";

interface TenantLayoutProps {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}

/**
 * Tenant Layout
 * 
 * This layout wraps all /t/[slug]/* routes.
 * It requires the user to have access to the tenant.
 */
export default async function TenantLayout({
    children,
    params,
}: TenantLayoutProps) {
    const { slug } = await params;

    // This will redirect to /dashboard if user doesn't have access
    const { user, tenant } = await requireTenantAccess(slug);

    const isAdmin = user.role === "ADMIN" || user.isSuperAdmin;

    return (
        <SidebarProvider>
            {/* Sidebar */}
            <AppSidebar
                slug={slug}
                tenantName={tenant.name}
                tenantPlan={tenant.plan}
                isAdmin={isAdmin}
                isSuperAdmin={user.isSuperAdmin}
            />

            {/* Main Content Area */}
            <SidebarInset>
                {/* Header */}
                <header className="flex h-14 items-center justify-between border-b bg-background px-4">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger />
                        <span className="text-sm text-muted-foreground">
                            {tenant.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                            {user.firstName} ({user.role})
                        </span>
                        <ThemeToggle />
                        <UserButton afterSwitchSessionUrl="/" />
                    </div>
                </header>

                {/* Page Content with scroll */}
                <main className="flex-1 overflow-auto bg-muted/40 p-6">
                    {children}
                </main>
            </SidebarInset>
            <Toaster position="top-right" richColors />
        </SidebarProvider>
    );
}
