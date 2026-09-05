-- CreateTable
CREATE TABLE "enquiry_field_configs" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_field_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_field_configs_serviceType_fieldKey_key" ON "enquiry_field_configs"("serviceType", "fieldKey");
