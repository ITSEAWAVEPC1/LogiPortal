-- CreateEnum
CREATE TYPE "ShipmentType" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('FREIGHT_FORWARDING', 'CUSTOMS_CLEARANCE', 'TRANSPORTATION', 'WAREHOUSING', 'EXIM_CONSULTANCY');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('DRAFT', 'OPEN', 'READY_FOR_QUOTATION', 'NEEDS_CORRECTION');

-- CreateEnum
CREATE TYPE "CargoMode" AS ENUM ('LCL_AIR', 'FCL');

-- CreateEnum
CREATE TYPE "TransportDeliveryType" AS ENUM ('LOADED', 'DESTUFF');

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "sequenceNumber" SERIAL NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactPersonName" TEXT,
    "contactPersonPhone" TEXT,
    "contactPersonEmail" TEXT,
    "shipmentType" "ShipmentType",
    "serviceTypes" "ServiceType"[] DEFAULT ARRAY[]::"ServiceType"[],
    "rfqReason" TEXT,
    "doerId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_freight_details" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "incoterm" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "cargoMode" "CargoMode",
    "packageCount" INTEGER,
    "dimensions" TEXT,
    "weight" DOUBLE PRECISION,
    "fclWeight" DOUBLE PRECISION,
    "containerType" TEXT,
    "containerCount" INTEGER,
    "isOdc" BOOLEAN NOT NULL DEFAULT false,
    "odcDimensions" TEXT,
    "odcPackageCount" INTEGER,
    "odcPerPackageWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_freight_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_customs_details" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "hsCode" TEXT,
    "commodity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_customs_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_transport_details" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "pickup" TEXT,
    "destination" TEXT,
    "cargoMode" "CargoMode",
    "packageCount" INTEGER,
    "dimensions" TEXT,
    "weight" DOUBLE PRECISION,
    "fclWeight" DOUBLE PRECISION,
    "containerType" TEXT,
    "deliveryType" "TransportDeliveryType",
    "isOdc" BOOLEAN NOT NULL DEFAULT false,
    "odcDimensions" TEXT,
    "odcPackageCount" INTEGER,
    "odcPerPackageWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_transport_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiries_branchId_idx" ON "enquiries"("branchId");

-- CreateIndex
CREATE INDEX "enquiries_organizationId_idx" ON "enquiries"("organizationId");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE INDEX "enquiries_doerId_idx" ON "enquiries"("doerId");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_freight_details_enquiryId_key" ON "enquiry_freight_details"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_customs_details_enquiryId_key" ON "enquiry_customs_details"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_transport_details_enquiryId_key" ON "enquiry_transport_details"("enquiryId");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_doerId_fkey" FOREIGN KEY ("doerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_freight_details" ADD CONSTRAINT "enquiry_freight_details_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_customs_details" ADD CONSTRAINT "enquiry_customs_details_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_transport_details" ADD CONSTRAINT "enquiry_transport_details_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
