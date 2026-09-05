-- AlterTable
ALTER TABLE "quotation_line_items" ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "rateInr" DOUBLE PRECISION;
