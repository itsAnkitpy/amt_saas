/*
  Warnings:

  - You are about to drop the column `blobUrl` on the `asset_images` table. All the data in the column will be lost.
  - You are about to drop the column `thumbBlobUrl` on the `asset_images` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "asset_images" DROP COLUMN "blobUrl",
DROP COLUMN "thumbBlobUrl";
