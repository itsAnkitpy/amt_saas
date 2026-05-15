-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MAINTENANCE_OVERDUE', 'MAINTENANCE_DUE_SOON', 'WARRANTY_EXPIRING', 'ASSET_ASSIGNED_TO_YOU');

-- CreateEnum
CREATE TYPE "NotificationSourceType" AS ENUM ('MAINTENANCE_JOB', 'ASSET', 'ASSET_ASSIGNMENT');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "sourceType" "NotificationSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "inAppVisible" BOOLEAN NOT NULL DEFAULT true,
    "emailEligible" BOOLEAN NOT NULL DEFAULT true,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_tenantId_dismissedAt_readAt_createdAt_idx" ON "notifications"("userId", "tenantId", "dismissedAt", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_emailEligible_emailSentAt_readAt_dis_idx" ON "notifications"("tenantId", "emailEligible", "emailSentAt", "readAt", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_tenantId_userId_type_dedupeKey_key" ON "notifications"("tenantId", "userId", "type", "dedupeKey");

-- CreateIndex
CREATE INDEX "notification_preferences_tenantId_userId_idx" ON "notification_preferences"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_userId_type_key" ON "notification_preferences"("tenantId", "userId", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
