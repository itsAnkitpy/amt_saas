"use server";

import { revalidatePath } from "next/cache";
import {
    completeMaintenanceJobForAsset,
    disableMaintenanceScheduleForAsset,
    getMaintenanceServiceErrorMessage,
    startMaintenanceJobForAsset,
    upsertMaintenanceScheduleForAsset,
} from "@/lib/maintenance-service";

function revalidateMaintenanceViews(tenantSlug: string, assetId: string) {
    revalidatePath(`/t/${tenantSlug}/assets`);
    revalidatePath(`/t/${tenantSlug}/assets/${assetId}`);
    revalidatePath(`/t/${tenantSlug}/maintenance`);
    revalidatePath(`/t/${tenantSlug}/dashboard`);
    revalidatePath(`/t/${tenantSlug}/activity`);
}

export async function upsertMaintenanceSchedule(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    try {
        await upsertMaintenanceScheduleForAsset(tenantSlug, assetId, input);
    } catch (error) {
        return {
            error: getMaintenanceServiceErrorMessage(
                error,
                "Failed to save maintenance schedule"
            ),
        };
    }

    revalidateMaintenanceViews(tenantSlug, assetId);
}

export async function disableMaintenanceSchedule(
    tenantSlug: string,
    assetId: string
) {
    try {
        await disableMaintenanceScheduleForAsset(tenantSlug, assetId);
    } catch (error) {
        return {
            error: getMaintenanceServiceErrorMessage(
                error,
                "Failed to disable maintenance schedule"
            ),
        };
    }

    revalidateMaintenanceViews(tenantSlug, assetId);
}

export async function startMaintenanceJob(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    try {
        await startMaintenanceJobForAsset(tenantSlug, assetId, input);
    } catch (error) {
        return {
            error: getMaintenanceServiceErrorMessage(
                error,
                "Failed to start maintenance job"
            ),
        };
    }

    revalidateMaintenanceViews(tenantSlug, assetId);
}

export async function completeMaintenanceJob(
    tenantSlug: string,
    assetId: string,
    input: unknown
) {
    try {
        await completeMaintenanceJobForAsset(tenantSlug, assetId, input);
    } catch (error) {
        return {
            error: getMaintenanceServiceErrorMessage(
                error,
                "Failed to complete maintenance job"
            ),
        };
    }

    revalidateMaintenanceViews(tenantSlug, assetId);
}
