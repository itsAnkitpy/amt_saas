import { z } from "zod";

/**
 * Notification preferences validation (Module 10 M3).
 *
 * The form submits all four event types in a single payload so partial saves
 * cannot leave a user with an inconsistent prefs grid.
 */

export const NotificationTypeSchema = z.enum([
    "MAINTENANCE_OVERDUE",
    "MAINTENANCE_DUE_SOON",
    "WARRANTY_EXPIRING",
    "ASSET_ASSIGNED_TO_YOU",
]);

export type NotificationTypeValue = z.infer<typeof NotificationTypeSchema>;

export const NotificationPreferenceItemSchema = z.object({
    type: NotificationTypeSchema,
    inApp: z.boolean(),
    email: z.boolean(),
});

export const NotificationPreferencesSchema = z.object({
    preferences: z.array(NotificationPreferenceItemSchema).length(4),
});

export type NotificationPreferenceItem = z.infer<typeof NotificationPreferenceItemSchema>;
export type NotificationPreferencesInput = z.infer<typeof NotificationPreferencesSchema>;
