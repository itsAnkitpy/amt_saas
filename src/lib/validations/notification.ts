import { z } from "zod";
import { CuidSchema } from "./common";

export const NotificationTypeSchema = z.enum([
    "MAINTENANCE_OVERDUE",
    "MAINTENANCE_DUE_SOON",
    "WARRANTY_EXPIRING",
    "ASSET_ASSIGNED_TO_YOU",
]);

export const NotificationSourceTypeSchema = z.enum([
    "MAINTENANCE_JOB",
    "ASSET",
    "ASSET_ASSIGNMENT",
]);

/**
 * Input shape passed into notification-service.createNotification.
 * Recipient resolution + dedupe key building happen inside the service.
 */
export const CreateNotificationInputSchema = z.object({
    tenantId: CuidSchema,
    type: NotificationTypeSchema,
    sourceType: NotificationSourceTypeSchema,
    sourceId: z.string().min(1),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
    payload: z.record(z.string(), z.unknown()).optional(),
});

export const UpdatePreferenceSchema = z.object({
    type: NotificationTypeSchema,
    inApp: z.boolean(),
    email: z.boolean(),
});

export const ListNotificationsQuerySchema = z.object({
    unreadOnly: z.coerce.boolean().optional().default(false),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    cursor: CuidSchema.optional(),
});

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationSourceType = z.infer<typeof NotificationSourceTypeSchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
export type UpdatePreferenceInput = z.infer<typeof UpdatePreferenceSchema>;
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
