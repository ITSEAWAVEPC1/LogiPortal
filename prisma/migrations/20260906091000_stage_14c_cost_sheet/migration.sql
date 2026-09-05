-- CreateTable
CREATE TABLE "quotation_cost_sheets" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "defaultMarginPct" DOUBLE PRECISION,
    "notes" TEXT,
    "preparedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_cost_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_cost_lines" (
    "id" TEXT NOT NULL,
    "costSheetId" TEXT NOT NULL,
    "category" "QuotationChargeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "vendorName" TEXT,
    "buyRate" DOUBLE PRECISION,
    "buyCurrency" TEXT NOT NULL DEFAULT 'INR',
    "buyExchangeRate" DOUBLE PRECISION,
    "buyRateInr" DOUBLE PRECISION,
    "marginPct" DOUBLE PRECISION,
    "marginFlat" DOUBLE PRECISION,
    "sellRate" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_cost_sheets_quotationId_key" ON "quotation_cost_sheets"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_cost_lines_costSheetId_idx" ON "quotation_cost_lines"("costSheetId");

-- AddForeignKey
ALTER TABLE "quotation_cost_sheets" ADD CONSTRAINT "quotation_cost_sheets_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_cost_lines" ADD CONSTRAINT "quotation_cost_lines_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "quotation_cost_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
