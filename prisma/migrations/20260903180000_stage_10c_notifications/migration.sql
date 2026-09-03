-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORKFLOW_STEP_SUBMITTED', 'WORKFLOW_STEP_APPROVED', 'WORKFLOW_STEP_REJECTED', 'JOB_WORKFLOW_STARTED', 'JOB_COMPLETED', 'ENQUIRY_READY', 'ENQUIRY_NEEDS_CORRECTION', 'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_NEEDS_CORRECTION', 'QUOTATION_SENT', 'QUOTATION_CUSTOMER_APPROVED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DOCUMENT_SHARED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkPath" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "emailStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mutedTypes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_emailStatus_nextAttemptAt_idx" ON "notifications"("emailStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
