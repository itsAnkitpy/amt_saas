-- Keep maintenance state consistent even if an asset is archived outside the
-- application service layer.

CREATE OR REPLACE FUNCTION "cancel_asset_maintenance_on_archive"()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."archivedAt" IS NULL AND NEW."archivedAt" IS NOT NULL THEN
        UPDATE "asset_maintenance_schedules"
        SET
            "isActive" = false,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE
            "assetId" = NEW."id"
            AND "isActive" = true;

        UPDATE "maintenance_jobs"
        SET
            "status" = 'CANCELLED',
            "cancelledAt" = COALESCE(NEW."archivedAt", CURRENT_TIMESTAMP),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE
            "assetId" = NEW."id"
            AND "status" IN ('OPEN', 'IN_PROGRESS');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "assets_archive_maintenance_cleanup" ON "assets";

CREATE TRIGGER "assets_archive_maintenance_cleanup"
AFTER UPDATE OF "archivedAt" ON "assets"
FOR EACH ROW
EXECUTE FUNCTION "cancel_asset_maintenance_on_archive"();
