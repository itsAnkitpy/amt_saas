-- CreateEnum
CREATE TYPE "AssetAction" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'DELETED', 'RESTORED', 'IMAGE_ADDED', 'IMAGE_REMOVED');

-- CreateTable
CREATE TABLE "asset_activities" (
    "id" TEXT NOT NULL,
    "action" "AssetAction" NOT NULL,
    "details" JSONB,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "asset_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_activities_assetId_idx" ON "asset_activities"("assetId");

-- CreateIndex
CREATE INDEX "asset_activities_tenantId_createdAt_idx" ON "asset_activities"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_activities_tenantId_action_idx" ON "asset_activities"("tenantId", "action");

-- AddForeignKey
ALTER TABLE "asset_activities" ADD CONSTRAINT "asset_activities_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
