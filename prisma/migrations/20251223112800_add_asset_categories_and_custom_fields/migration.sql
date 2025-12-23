/*
  Warnings:

  - The values [WORKING,NOT_WORKING,UNDER_REPAIR] on the enum `AssetCondition` will be removed. If these variants are still used in the database, this will fail.
  - The values [UNDER_REPAIR] on the enum `AssetStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `description` on the `assets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,serialNumber]` on the table `assets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,assetTag]` on the table `assets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryId` to the `assets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssetCondition_new" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');
ALTER TABLE "public"."assets" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "assets" ALTER COLUMN "condition" TYPE "AssetCondition_new" USING ("condition"::text::"AssetCondition_new");
ALTER TYPE "AssetCondition" RENAME TO "AssetCondition_old";
ALTER TYPE "AssetCondition_new" RENAME TO "AssetCondition";
DROP TYPE "public"."AssetCondition_old";
ALTER TABLE "assets" ALTER COLUMN "condition" SET DEFAULT 'GOOD';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AssetStatus_new" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED');
ALTER TABLE "public"."assets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "assets" ALTER COLUMN "status" TYPE "AssetStatus_new" USING ("status"::text::"AssetStatus_new");
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
ALTER TABLE "assets" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- DropIndex
DROP INDEX "assets_serialNumber_tenantId_key";

-- DropIndex
DROP INDEX "assets_tenantId_status_idx";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "description",
ADD COLUMN     "assetTag" TEXT,
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DECIMAL(10,2),
ADD COLUMN     "warrantyEnd" TIMESTAMP(3),
ALTER COLUMN "serialNumber" DROP NOT NULL,
ALTER COLUMN "condition" SET DEFAULT 'GOOD';

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "fieldSchema" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_categories_tenantId_idx" ON "asset_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_tenantId_name_key" ON "asset_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "asset_assignments_assetId_idx" ON "asset_assignments"("assetId");

-- CreateIndex
CREATE INDEX "asset_assignments_userId_idx" ON "asset_assignments"("userId");

-- CreateIndex
CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_serialNumber_key" ON "assets"("tenantId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_assetTag_key" ON "assets"("tenantId", "assetTag");

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
