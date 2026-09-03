-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "actualDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "jobs_branchId_createdAt_idx" ON "jobs"("branchId", "createdAt");
