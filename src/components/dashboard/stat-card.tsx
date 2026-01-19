'use client';

import {
    Package,
    CheckCircle2,
    UserCheck,
    Wrench,
    DollarSign,
    Users,
    AlertTriangle,
    BarChart3,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon mapping - icons must be imported here in client component
const iconMap: Record<string, LucideIcon> = {
    package: Package,
    'check-circle': CheckCircle2,
    'user-check': UserCheck,
    wrench: Wrench,
    'dollar-sign': DollarSign,
    users: Users,
    'alert-triangle': AlertTriangle,
    'bar-chart': BarChart3,
};

interface StatCardProps {
    title: string;
    value: string | number;
    iconName?: keyof typeof iconMap;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'default' | 'green' | 'blue' | 'amber' | 'violet';
    className?: string;
}

const colorVariants = {
    default: {
        icon: 'text-zinc-500',
        value: 'text-zinc-900 dark:text-white',
    },
    green: {
        icon: 'text-green-500',
        value: 'text-green-600 dark:text-green-400',
    },
    blue: {
        icon: 'text-blue-500',
        value: 'text-blue-600 dark:text-blue-400',
    },
    amber: {
        icon: 'text-amber-500',
        value: 'text-amber-600 dark:text-amber-400',
    },
    violet: {
        icon: 'text-violet-500',
        value: 'text-violet-600 dark:text-violet-400',
    },
};

/**
 * Stat Card Component
 * 
 * Displays a single statistic with optional icon and trend indicator.
 * Used in the dashboard for key metrics like total assets, available count, etc.
 * 
 * Note: Icons are passed as string names (not components) to support
 * Server Component → Client Component data passing in Next.js 16.
 */
export function StatCard({
    title,
    value,
    iconName,
    trend,
    color = 'default',
    className,
}: StatCardProps) {
    const colors = colorVariants[color];
    const Icon = iconName ? iconMap[iconName] : null;

    return (
        <div
            className={cn(
                'rounded-xl border bg-white p-6 shadow-sm dark:bg-zinc-950',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {title}
                </p>
                {Icon && (
                    <Icon className={cn('h-5 w-5', colors.icon)} />
                )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
                <p className={cn('text-3xl font-bold', colors.value)}>
                    {value}
                </p>
                {trend && (
                    <span
                        className={cn(
                            'text-sm font-medium',
                            trend.isPositive
                                ? 'text-green-600'
                                : 'text-red-600'
                        )}
                    >
                        {trend.isPositive ? '+' : ''}
                        {trend.value}%
                    </span>
                )}
            </div>
        </div>
    );
}
