-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "tenantId" DROP NOT NULL;
