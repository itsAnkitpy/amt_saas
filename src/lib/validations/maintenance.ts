import { z } from 'zod';
import { CuidSchema } from './common';

export const MaintenanceIntervalUnitSchema = z.enum([
    'DAYS',
    'WEEKS',
    'MONTHS',
    'YEARS',
]);

export const MaintenanceJobStatusSchema = z.enum([
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
]);

const OptionalNotesSchema = z.preprocess((value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}, z.string().max(2000).nullable().optional());

const OptionalCostSchema = z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    return value;
}, z.coerce.number().min(0).nullable().optional());

export const MaintenanceScheduleInputSchema = z.object({
    intervalValue: z.coerce.number().int().min(1, 'Maintenance interval is required'),
    intervalUnit: MaintenanceIntervalUnitSchema,
    firstDueAt: z.coerce.date(),
    instructions: OptionalNotesSchema,
});

export const StartMaintenanceJobSchema = z.object({
    jobId: CuidSchema,
});

export const CompleteMaintenanceJobSchema = z.object({
    jobId: CuidSchema,
    notes: OptionalNotesSchema,
    cost: OptionalCostSchema,
});

export type MaintenanceIntervalUnit = z.infer<typeof MaintenanceIntervalUnitSchema>;
export type MaintenanceJobStatus = z.infer<typeof MaintenanceJobStatusSchema>;
export type MaintenanceScheduleInput = z.infer<typeof MaintenanceScheduleInputSchema>;
export type StartMaintenanceJob = z.infer<typeof StartMaintenanceJobSchema>;
export type CompleteMaintenanceJob = z.infer<typeof CompleteMaintenanceJobSchema>;
