import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSql = readFileSync(
    "prisma/migrations/20260514130000_harden_archive_maintenance_cleanup/migration.sql",
    "utf8"
);

test("archive maintenance hardening migration cancels open maintenance when archivedAt is set", () => {
    assert.match(
        migrationSql,
        /CREATE TRIGGER "assets_archive_maintenance_cleanup"/
    );
    assert.match(migrationSql, /AFTER UPDATE OF "archivedAt" ON "assets"/);
    assert.match(
        migrationSql,
        /OLD\."archivedAt" IS NULL AND NEW\."archivedAt" IS NOT NULL/
    );
    assert.match(migrationSql, /UPDATE "asset_maintenance_schedules"/);
    assert.match(migrationSql, /"isActive" = false/);
    assert.match(migrationSql, /UPDATE "maintenance_jobs"/);
    assert.match(migrationSql, /"status" = 'CANCELLED'/);
    assert.match(migrationSql, /"status" IN \('OPEN', 'IN_PROGRESS'\)/);
});
