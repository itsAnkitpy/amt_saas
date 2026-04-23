-- AlterEnum
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_SCHEDULED';
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_UPDATED';
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_DISABLED';
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_STARTED';
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_COMPLETED';
ALTER TYPE "AssetAction" ADD VALUE 'MAINTENANCE_CANCELLED';

-- CreateEnum
CREATE TYPE "MaintenanceIntervalUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "MaintenanceJobStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "asset_categories"
ADD COLUMN     "defaultMaintenanceInstructions" TEXT,
ADD COLUMN     "defaultMaintenanceIntervalUnit" "MaintenanceIntervalUnit",
ADD COLUMN     "defaultMaintenanceIntervalValue" INTEGER;

-- CreateTable
CREATE TABLE "asset_maintenance_schedules" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "intervalValue" INTEGER NOT NULL,
    "intervalUnit" "MaintenanceIntervalUnit" NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_jobs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "status" "MaintenanceJobStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "cost" DECIMAL(10,2),
    "completedById" TEXT,
    "completedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_maintenance_schedules_assetId_key" ON "asset_maintenance_schedules"("assetId");

-- CreateIndex
CREATE INDEX "asset_maintenance_schedules_isActive_idx" ON "asset_maintenance_schedules"("isActive");

-- CreateIndex
CREATE INDEX "maintenance_jobs_assetId_status_idx" ON "maintenance_jobs"("assetId", "status");

-- CreateIndex
CREATE INDEX "maintenance_jobs_scheduleId_status_idx" ON "maintenance_jobs"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "maintenance_jobs_status_dueAt_idx" ON "maintenance_jobs"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "asset_maintenance_schedules" ADD CONSTRAINT "asset_maintenance_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "asset_maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
