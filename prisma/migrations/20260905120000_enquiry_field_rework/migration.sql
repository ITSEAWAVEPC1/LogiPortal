-- CreateEnum
CREATE TYPE "DimensionUnit" AS ENUM ('MM', 'CM');

-- CreateTable
CREATE TABLE "ports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_freight_packages" (
    "id" TEXT NOT NULL,
    "enquiryFreightDetailId" TEXT NOT NULL,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "dimensionUnit" "DimensionUnit",
    "weight" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_freight_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_commodity_lines" (
    "id" TEXT NOT NULL,
    "enquiryCustomsDetailId" TEXT NOT NULL,
    "hsCode" TEXT,
    "commodity" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_commodity_lines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "enquiry_freight_details" ADD COLUMN     "portOfLoadingId" TEXT,
ADD COLUMN     "portOfDischargeId" TEXT,
ADD COLUMN     "finalDestinationAddress" TEXT;

-- AlterTable
ALTER TABLE "enquiry_transport_details" ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "dimensionUnit" "DimensionUnit";

-- CreateIndex
CREATE UNIQUE INDEX "ports_code_key" ON "ports"("code");

-- CreateIndex
CREATE INDEX "enquiry_freight_packages_enquiryFreightDetailId_idx" ON "enquiry_freight_packages"("enquiryFreightDetailId");

-- CreateIndex
CREATE INDEX "enquiry_commodity_lines_enquiryCustomsDetailId_idx" ON "enquiry_commodity_lines"("enquiryCustomsDetailId");

-- AddForeignKey
ALTER TABLE "enquiry_freight_details" ADD CONSTRAINT "enquiry_freight_details_portOfLoadingId_fkey" FOREIGN KEY ("portOfLoadingId") REFERENCES "ports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_freight_details" ADD CONSTRAINT "enquiry_freight_details_portOfDischargeId_fkey" FOREIGN KEY ("portOfDischargeId") REFERENCES "ports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_freight_packages" ADD CONSTRAINT "enquiry_freight_packages_enquiryFreightDetailId_fkey" FOREIGN KEY ("enquiryFreightDetailId") REFERENCES "enquiry_freight_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_commodity_lines" ADD CONSTRAINT "enquiry_commodity_lines_enquiryCustomsDetailId_fkey" FOREIGN KEY ("enquiryCustomsDetailId") REFERENCES "enquiry_customs_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;
