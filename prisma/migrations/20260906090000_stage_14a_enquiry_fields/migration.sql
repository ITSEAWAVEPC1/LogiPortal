-- AlterEnum
ALTER TYPE "DimensionUnit" ADD VALUE IF NOT EXISTS 'IN';
ALTER TYPE "DimensionUnit" ADD VALUE IF NOT EXISTS 'FT';
ALTER TYPE "DimensionUnit" ADD VALUE IF NOT EXISTS 'M';

-- AlterTable
ALTER TABLE "enquiry_freight_packages" ADD COLUMN     "numberOfContainers" INTEGER;
