-- CreateEnum
CREATE TYPE "BankAccountKind" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "BillToType" AS ENUM ('DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "DueDateBasis" AS ENUM ('TRANSACTION_DATE', 'INVOICE_DATE', 'BILL_DATE');

-- CreateEnum
CREATE TYPE "ClubChargesOption" AS ENUM ('NO_GROUPING', 'GROUP_BY_SHIPMENT', 'GROUP_BY_JOB');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "alias" TEXT,
ADD COLUMN     "defaultCurrency" TEXT,
ADD COLUMN     "isAgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCarrier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isConsignee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isShipper" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "organization_branches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isDeactivated" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "telephone" TEXT,
    "fax" TEXT,
    "website" TEXT,
    "email" TEXT,
    "lobWise" BOOLEAN NOT NULL DEFAULT false,
    "taxableType" TEXT NOT NULL DEFAULT 'Standard',
    "salesPersonId" TEXT,
    "collectionExecutiveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_addresses" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "addressType" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "state" TEXT,
    "telephone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_contacts" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "titleDesignation" TEXT,
    "department" TEXT,
    "mobile" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_account_managers" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "forCategory" TEXT NOT NULL,
    "managerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_account_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_bank_accounts" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountKind" "BankAccountKind" NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankBranch" TEXT,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT,
    "transactionCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_account_infos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isUnlimitedCredit" BOOLEAN NOT NULL DEFAULT false,
    "cashOnDelivery" BOOLEAN NOT NULL DEFAULT false,
    "includeWipShipmentInOverdue" BOOLEAN NOT NULL DEFAULT false,
    "isCreditOnHold" BOOLEAN NOT NULL DEFAULT false,
    "creditOnHoldRemark" TEXT,
    "receivableCreditPeriodDays" INTEGER,
    "customerGLCode" TEXT,
    "notificationEmails" TEXT,
    "currency" TEXT,
    "tdsReceivable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_account_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_account_infos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isUnlimitedCredit" BOOLEAN NOT NULL DEFAULT false,
    "payableCreditPeriodDays" INTEGER,
    "dueDateCalculatedOn" "DueDateBasis" NOT NULL DEFAULT 'TRANSACTION_DATE',
    "vendorGLCode" TEXT,
    "notificationEmails" TEXT,
    "currency" TEXT,
    "isPaymentOnHold" BOOLEAN NOT NULL DEFAULT false,
    "tdsPayable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_account_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_bill_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billTypeId" TEXT NOT NULL,
    "dueAfterDays" INTEGER,
    "overrideCreditPeriod" BOOLEAN NOT NULL DEFAULT false,
    "billTo" "BillToType" NOT NULL DEFAULT 'DIRECT',
    "billToOrganizationId" TEXT,
    "clubCharges" "ClubChargesOption" NOT NULL DEFAULT 'NO_GROUPING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_bill_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_column_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_column_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_branches_organizationId_idx" ON "organization_branches"("organizationId");

-- CreateIndex
CREATE INDEX "branch_addresses_branchId_idx" ON "branch_addresses"("branchId");

-- CreateIndex
CREATE INDEX "branch_contacts_branchId_idx" ON "branch_contacts"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_account_managers_branchId_forCategory_key" ON "branch_account_managers"("branchId", "forCategory");

-- CreateIndex
CREATE INDEX "organization_bank_accounts_branchId_idx" ON "organization_bank_accounts"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_account_infos_organizationId_key" ON "customer_account_infos"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_account_infos_organizationId_key" ON "vendor_account_infos"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_types_code_key" ON "bill_types"("code");

-- CreateIndex
CREATE INDEX "organization_bill_types_organizationId_idx" ON "organization_bill_types"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_bill_types_organizationId_billTypeId_key" ON "organization_bill_types"("organizationId", "billTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_column_preferences_userId_screenKey_key" ON "user_column_preferences"("userId", "screenKey");

-- AddForeignKey
ALTER TABLE "organization_branches" ADD CONSTRAINT "organization_branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_branches" ADD CONSTRAINT "organization_branches_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_branches" ADD CONSTRAINT "organization_branches_collectionExecutiveId_fkey" FOREIGN KEY ("collectionExecutiveId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_addresses" ADD CONSTRAINT "branch_addresses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "organization_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_contacts" ADD CONSTRAINT "branch_contacts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "organization_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_account_managers" ADD CONSTRAINT "branch_account_managers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "organization_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_account_managers" ADD CONSTRAINT "branch_account_managers_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bank_accounts" ADD CONSTRAINT "organization_bank_accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "organization_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_account_infos" ADD CONSTRAINT "customer_account_infos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_account_infos" ADD CONSTRAINT "vendor_account_infos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bill_types" ADD CONSTRAINT "organization_bill_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bill_types" ADD CONSTRAINT "organization_bill_types_billTypeId_fkey" FOREIGN KEY ("billTypeId") REFERENCES "bill_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bill_types" ADD CONSTRAINT "organization_bill_types_billToOrganizationId_fkey" FOREIGN KEY ("billToOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_column_preferences" ADD CONSTRAINT "user_column_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
