import { startOfDay } from "date-fns";

/**
 * Single source of truth for "today" across maintenance attention,
 * notification scans, and digest filtering. Returns the local-midnight
 * for `now` (server-local; Vercel servers are UTC).
 *
 * Use this everywhere instead of inlining `startOfDay(new Date())` so
 * notification scan windows always agree with `maintenance.ts` attention.
 */
export function getTodayStart(now: Date = new Date()): Date {
    return startOfDay(now);
}
