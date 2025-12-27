'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BoxIcon,
    LayoutDashboardIcon,
    PackageIcon,
    ScanIcon,
    UsersIcon,
    SettingsIcon,
    ChevronLeftIcon,
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupContent,
    SidebarRail,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
    slug: string;
    tenantName: string;
    tenantPlan: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export function AppSidebar({
    slug,
    tenantName,
    tenantPlan,
    isAdmin,
    isSuperAdmin,
}: AppSidebarProps) {
    const pathname = usePathname();

    const navItems = [
        {
            title: 'Dashboard',
            href: `/t/${slug}/dashboard`,
            icon: LayoutDashboardIcon,
        },
        {
            title: 'Assets',
            href: `/t/${slug}/assets`,
            icon: PackageIcon,
        },
        {
            title: 'Scan',
            href: `/t/${slug}/scan`,
            icon: ScanIcon,
        },
    ];

    const adminItems = [
        {
            title: 'Users',
            href: `/t/${slug}/users`,
            icon: UsersIcon,
        },
        {
            title: 'Settings',
            href: `/t/${slug}/settings`,
            icon: SettingsIcon,
        },
    ];

    return (
        <Sidebar collapsible="icon">
            {/* Header with Logo */}
            <SidebarHeader className="border-b">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={`/t/${slug}/dashboard`}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                                    <BoxIcon className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">{tenantName}</span>
                                    <span className="text-xs text-sidebar-foreground/70">{tenantPlan} Plan</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* Main Navigation */}
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                                        tooltip={item.title}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="size-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Admin Section */}
                {isAdmin && (
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {adminItems.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={pathname === item.href}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="size-4" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="border-t">
                <SidebarMenu>
                    {isSuperAdmin && (
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild tooltip="Admin Panel">
                                <Link href="/admin" className="text-violet-600">
                                    <ChevronLeftIcon className="size-4" />
                                    <span>Admin Panel</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="My Account">
                            <Link href="/dashboard">
                                <ChevronLeftIcon className="size-4" />
                                <span>My Account</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            {/* Rail for resize/toggle */}
            <SidebarRail />
        </Sidebar>
    );
}
