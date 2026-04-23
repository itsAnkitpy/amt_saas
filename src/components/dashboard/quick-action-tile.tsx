import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface QuickActionTileProps {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
}

export function QuickActionTile({
    title,
    description,
    href,
    icon: Icon,
}: QuickActionTileProps) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-zinc-900 dark:text-white">
                {title}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {description}
            </p>
        </Link>
    );
}
