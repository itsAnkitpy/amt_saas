"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, RotateCcwIcon, TrashIcon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAsset, restoreAsset, unassignAsset } from "../actions";

interface AssetActionButtonProps {
    assetId: string;
    tenantSlug: string;
}

export function UnassignAssetButton({
    assetId,
    tenantSlug,
}: AssetActionButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleUnassign = () => {
        startTransition(async () => {
            const result = await unassignAsset(tenantSlug, assetId);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            router.refresh();
        });
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUnassign}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <UserMinusIcon className="mr-2 h-4 w-4" />
            )}
            Unassign
        </Button>
    );
}

export function ArchiveAssetButton({
    assetId,
    tenantSlug,
}: AssetActionButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleArchive = () => {
        startTransition(async () => {
            const result = await deleteAsset(tenantSlug, assetId);

            if (result?.error) {
                toast.error(result.error);
            }
        });
    };

    return (
        <Button
            type="button"
            variant="outline"
            className="w-full text-red-600 hover:bg-red-50"
            onClick={handleArchive}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <TrashIcon className="mr-2 h-4 w-4" />
            )}
            Archive Asset
        </Button>
    );
}

export function RestoreAssetButton({
    assetId,
    tenantSlug,
}: AssetActionButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRestore = () => {
        startTransition(async () => {
            const result = await restoreAsset(tenantSlug, assetId);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Asset restored");
            router.refresh();
        });
    };

    return (
        <Button
            type="button"
            variant="outline"
            onClick={handleRestore}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <RotateCcwIcon className="mr-2 h-4 w-4" />
            )}
            Restore Asset
        </Button>
    );
}
