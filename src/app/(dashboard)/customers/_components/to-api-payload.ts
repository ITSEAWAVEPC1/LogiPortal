import type { OrganizationFormState } from "./types";

function num(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// Flattens the editor's client-side form state (bank accounts held as a flat
// list keyed by branchKey, for the reference UI's flat "Bank Details" grid)
// back into the nested shape /api/customers expects (bank accounts nested
// under each branch, matching the OrganizationBankAccount.branchId FK).
export function toApiPayload(form: OrganizationFormState) {
  return {
    name: form.name,
    alias: form.alias,
    contactPersonName: form.contactPersonName,
    contactPersonPhone: form.contactPersonPhone,
    contactPersonEmail: form.contactPersonEmail,
    city: form.city,
    state: form.state,
    branchId: form.branchId,
    isShipper: form.isShipper,
    isConsignee: form.isConsignee,
    isAgent: form.isAgent,
    isCarrier: form.isCarrier,
    isService: form.isService,
    isGlobal: form.isGlobal,
    defaultCurrency: form.defaultCurrency,
    gstNumber: form.gstNumber,
    panNumber: form.panNumber,
    tanNumber: form.tanNumber,
    branches: form.branches.map((b) => ({
      branchName: b.branchName,
      address: b.address,
      isDefault: b.isDefault,
      isDeactivated: b.isDeactivated,
      country: b.country,
      state: b.state,
      city: b.city,
      postalCode: b.postalCode,
      telephone: b.telephone,
      fax: b.fax,
      website: b.website,
      email: b.email,
      salesPersonId: b.salesPersonId,
      lobWise: b.lobWise,
      collectionExecutiveId: b.collectionExecutiveId,
      taxableType: b.taxableType,
      addresses: b.addresses.map((a) => ({
        addressType: a.addressType,
        name: a.name,
        address: a.address,
        city: a.city,
        postalCode: a.postalCode,
        state: a.state,
        telephone: a.telephone,
        fax: a.fax,
        email: a.email,
      })),
      contacts: b.contacts.map((c) => ({
        contactName: c.contactName,
        titleDesignation: c.titleDesignation,
        department: c.department,
        mobile: c.mobile,
        telephone: c.telephone,
        email: c.email,
        isPrimary: c.isPrimary,
      })),
      accountManagers: b.accountManagers
        .filter((m) => m.forCategory.trim() !== "")
        .map((m) => ({ forCategory: m.forCategory, managerUserId: m.managerUserId })),
      bankAccounts: form.bankAccounts
        .filter((acc) => acc.branchKey === b._key)
        .map((acc) => ({
          accountKind: acc.accountKind,
          bankName: acc.bankName,
          bankBranch: acc.bankBranch,
          accountNumber: acc.accountNumber,
          ifsc: acc.ifsc,
          transactionCurrency: acc.transactionCurrency,
        })),
    })),
    customerAccountInfo: form.customerAccountInfo
      ? {
          creditLimit: num(form.customerAccountInfo.creditLimit) ?? 0,
          isUnlimitedCredit: form.customerAccountInfo.isUnlimitedCredit,
          cashOnDelivery: form.customerAccountInfo.cashOnDelivery,
          includeWipShipmentInOverdue: form.customerAccountInfo.includeWipShipmentInOverdue,
          isCreditOnHold: form.customerAccountInfo.isCreditOnHold,
          creditOnHoldRemark: form.customerAccountInfo.creditOnHoldRemark,
          receivableCreditPeriodDays: num(form.customerAccountInfo.receivableCreditPeriodDays),
          customerGLCode: form.customerAccountInfo.customerGLCode,
          notificationEmails: form.customerAccountInfo.notificationEmails,
          currency: form.customerAccountInfo.currency,
          tdsReceivable: form.customerAccountInfo.tdsReceivable,
        }
      : null,
    vendorAccountInfo: form.vendorAccountInfo
      ? {
          creditLimit: num(form.vendorAccountInfo.creditLimit) ?? 0,
          isUnlimitedCredit: form.vendorAccountInfo.isUnlimitedCredit,
          payableCreditPeriodDays: num(form.vendorAccountInfo.payableCreditPeriodDays),
          dueDateCalculatedOn: form.vendorAccountInfo.dueDateCalculatedOn,
          vendorGLCode: form.vendorAccountInfo.vendorGLCode,
          notificationEmails: form.vendorAccountInfo.notificationEmails,
          currency: form.vendorAccountInfo.currency,
          isPaymentOnHold: form.vendorAccountInfo.isPaymentOnHold,
          tdsPayable: form.vendorAccountInfo.tdsPayable,
        }
      : null,
    billTypes: form.billTypes
      .filter((bt) => bt.billTypeId !== "")
      .map((bt) => ({
        billTypeId: bt.billTypeId,
        dueAfterDays: num(bt.dueAfterDays),
        overrideCreditPeriod: bt.overrideCreditPeriod,
        billTo: bt.billTo,
        billToOrganizationId: bt.billTo === "OTHER" ? bt.billToOrganizationId : "",
        clubCharges: bt.clubCharges,
      })),
  };
}
