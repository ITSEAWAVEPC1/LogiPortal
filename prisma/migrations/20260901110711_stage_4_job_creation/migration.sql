-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CORRECTION', 'WORKFLOW_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobOrigin" AS ENUM ('QUOTATION', 'DIRECT', 'IMPORTED');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "JobOrigin" NOT NULL DEFAULT 'QUOTATION',
    "sequenceNumber" SERIAL NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentType" "ShipmentType" NOT NULL,
    "serviceTypes" "ServiceType"[] DEFAULT ARRAY[]::"ServiceType"[],
    "incoterm" TEXT,
    "quotationEnquiryId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "agentDetails" TEXT,
    "placeOfReceipt" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "placeOfDelivery" TEXT,
    "shippingLineName" TEXT,
    "cfsName" TEXT,
    "vesselName" TEXT,
    "voyageNumber" TEXT,
    "freeDaysAtPod" INTEGER,
    "totalGrossWeight" DOUBLE PRECISION,
    "totalNetWeight" DOUBLE PRECISION,
    "totalPackages" INTEGER,
    "volumeCbm" DOUBLE PRECISION,
    "commodity" TEXT,
    "hsCode" TEXT,
    "charges" JSONB,
    "chargesCurrency" TEXT,
    "quotedTotal" DOUBLE PRECISION,
    "dutyPaymentLiability" TEXT,
    "dutyAmount" DOUBLE PRECISION,
    "dutyPaidBy" TEXT,
    "internalNotes" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipper_details" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipper_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignee_details" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignee_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_party_details" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_party_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_details" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "containerNumber" TEXT,
    "sealNumber" TEXT,
    "containerType" TEXT,
    "count" INTEGER DEFAULT 1,
    "grossWeight" DOUBLE PRECISION,
    "tareWeight" DOUBLE PRECISION,
    "netWeight" DOUBLE PRECISION,
    "packageCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_quotationEnquiryId_key" ON "jobs"("quotationEnquiryId");

-- CreateIndex
CREATE INDEX "jobs_branchId_idx" ON "jobs"("branchId");

-- CreateIndex
CREATE INDEX "jobs_organizationId_idx" ON "jobs"("organizationId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_shipmentType_idx" ON "jobs"("shipmentType");

-- CreateIndex
CREATE INDEX "jobs_createdById_idx" ON "jobs"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_details_jobId_key" ON "shipper_details"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "consignee_details_jobId_key" ON "consignee_details"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "notify_party_details_jobId_key" ON "notify_party_details"("jobId");

-- CreateIndex
CREATE INDEX "container_details_jobId_idx" ON "container_details"("jobId");

-- CreateIndex
CREATE INDEX "import_batches_entityType_idx" ON "import_batches"("entityType");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quotationEnquiryId_fkey" FOREIGN KEY ("quotationEnquiryId") REFERENCES "quotation_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_details" ADD CONSTRAINT "shipper_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignee_details" ADD CONSTRAINT "consignee_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_party_details" ADD CONSTRAINT "notify_party_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_details" ADD CONSTRAINT "container_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
