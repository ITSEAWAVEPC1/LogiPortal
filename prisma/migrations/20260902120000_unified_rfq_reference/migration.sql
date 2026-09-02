-- CreateTable
CREATE TABLE "reference_counters" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "refYear" INTEGER,
ADD COLUMN     "refSequence" INTEGER;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "refYear" INTEGER,
ADD COLUMN     "refSequence" INTEGER,
ADD COLUMN     "sourceReference" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "refYear" INTEGER,
ADD COLUMN     "refSequence" INTEGER,
ADD COLUMN     "sourceReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reference_counters_scope_year_key" ON "reference_counters"("scope", "year");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_referenceNo_key" ON "enquiries"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_refYear_refSequence_key" ON "enquiries"("refYear", "refSequence");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_referenceNo_key" ON "quotations"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_refYear_refSequence_key" ON "quotations"("refYear", "refSequence");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_referenceNo_key" ON "jobs"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_refYear_refSequence_key" ON "jobs"("refYear", "refSequence");
