'use client';

import { UserButton } from '@clerk/nextjs';
import dynamic from 'next/dynamic';

/**
 * Client-only wrapper for Clerk's UserButton
 * 
 * Uses Next.js dynamic import with ssr: false to prevent hydration mismatch.
 * The UserButton renders differently on server vs client, causing Next.js
 * to show a recoverable hydration error.
 */

// Placeholder shown during SSR and initial load
function UserButtonPlaceholder() {
    return (
        <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    );
}

// The actual button component (client-side only)
function UserButtonInner() {
    return <UserButton afterSwitchSessionUrl="/" />;
}

// Export as dynamic with SSR disabled
export const ClientUserButton = dynamic(
    () => Promise.resolve(UserButtonInner),
    {
        ssr: false,
        loading: UserButtonPlaceholder,
    }
);
