import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionCenterCardProps {
    title: string;
    count: number;
    description: string;
    emptyMessage: string;
    href: string;
    actionLabel: string;
    icon: LucideIcon;
    tone: "red" | "amber" | "blue" | "orange" | "zinc";
}

const toneStyles = {
    red: {
        card: "border-red-200 bg-red-50/70 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/15 dark:hover:bg-red-950/25",
        iconWrap: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        link: "text-red-700 dark:text-red-300",
    },
    amber: {
        card: "border-amber-200 bg-amber-50/70 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/15 dark:hover:bg-amber-950/25",
        iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        link: "text-amber-700 dark:text-amber-300",
    },
    blue: {
        card: "border-blue-200 bg-blue-50/70 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/15 dark:hover:bg-blue-950/25",
        iconWrap: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        link: "text-blue-700 dark:text-blue-300",
    },
    orange: {
        card: "border-orange-200 bg-orange-50/70 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/15 dark:hover:bg-orange-950/25",
        iconWrap: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        link: "text-orange-700 dark:text-orange-300",
    },
    zinc: {
        card: "border-zinc-200 bg-zinc-50/80 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-900",
        iconWrap: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        link: "text-zinc-700 dark:text-zinc-300",
    },
} as const;

export function ActionCenterCard({
    title,
    count,
    description,
    emptyMessage,
    href,
    actionLabel,
    icon: Icon,
    tone,
}: ActionCenterCardProps) {
    const styles = toneStyles[tone];
    const isClear = count === 0;

    return (
        <Link
            href={href}
            className={cn(
                "group flex h-full min-h-56 flex-col justify-between rounded-2xl border p-5 transition-all",
                styles.card
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className={cn("rounded-xl p-3", styles.iconWrap)}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", styles.badge)}>
                    {isClear ? "Clear" : `${count} open`}
                </span>
            </div>

            <div className="mt-8">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {title}
                </p>
                <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-white">
                    {count}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {isClear ? emptyMessage : description}
                </p>
            </div>

            <div className={cn("mt-6 flex items-center gap-1 text-sm font-medium", styles.link)}>
                {actionLabel}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
        </Link>
    );
}
