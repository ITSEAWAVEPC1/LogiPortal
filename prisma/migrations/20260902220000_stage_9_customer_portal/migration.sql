-- CreateEnum
CREATE TYPE "PortalAccessOutcome" AS ENUM ('DENIED_CROSS_ORG', 'DENIED_UNLINKED', 'DENIED_NOT_FOUND');

-- CreateTable
CREATE TABLE "portal_access_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewerOrgId" TEXT,
    "path" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "outcome" "PortalAccessOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_access_logs_userId_idx" ON "portal_access_logs"("userId");

-- CreateIndex
CREATE INDEX "portal_access_logs_createdAt_idx" ON "portal_access_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "portal_access_logs" ADD CONSTRAINT "portal_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
