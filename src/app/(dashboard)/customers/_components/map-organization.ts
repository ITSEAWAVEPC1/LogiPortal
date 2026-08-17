// Server-side mapping: Prisma's nested Organization shape -> the editor's
// flat client form state. Only imported from Server Components (page.tsx) —
// the `OrganizationDetail` type import is type-only and erased at build, so
// this stays safe to colocate with the client components.
import type { OrganizationDetail } from "@/lib/organizations/organization-include";
import { emptyOrganizationForm, nextKey, type BankAccountForm, type OrganizationFormState } from "./types";

export function mapOrganizationToForm(org: OrganizationDetail): OrganizationFormState {
  const base = emptyOrganizationForm();

  const branchKeyById = new Map<string, string>();
  const branches = org.branches.map((b) => {
    const key = nextKey("branch");
    branchKeyById.set(b.id, key);
    return {
      _key: key,
      branchName: b.branchName,
      address: b.address ?? "",
      isDefault: b.isDefault,
      isDeactivated: b.isDeactivated,
      country: b.country ?? "",
      state: b.state ?? "",
      city: b.city ?? "",
      postalCode: b.postalCode ?? "",
      telephone: b.telephone ?? "",
      fax: b.fax ?? "",
      website: b.website ?? "",
      email: b.email ?? "",
      salesPersonId: b.salesPersonId ?? "",
      lobWise: b.lobWise,
      collectionExecutiveId: b.collectionExecutiveId ?? "",
      taxableType: b.taxableType,
      addresses: b.addresses.map((a) => ({
        _key: nextKey("address"),
        addressType: a.addressType,
        name: a.name ?? "",
        address: a.address ?? "",
        city: a.city ?? "",
        postalCode: a.postalCode ?? "",
        state: a.state ?? "",
        telephone: a.telephone ?? "",
        fax: a.fax ?? "",
        email: a.email ?? "",
      })),
      contacts: b.contacts.map((c) => ({
        _key: nextKey("contact"),
        contactName: c.contactName,
        titleDesignation: c.titleDesignation ?? "",
        department: c.department ?? "",
        mobile: c.mobile ?? "",
        telephone: c.telephone ?? "",
        email: c.email ?? "",
        isPrimary: c.isPrimary,
      })),
      accountManagers: b.accountManagers.map((m) => ({
        _key: nextKey("accountManager"),
        forCategory: m.forCategory,
        managerUserId: m.managerUserId ?? "",
      })),
    };
  });

  const bankAccounts: BankAccountForm[] = org.branches.flatMap((b) =>
    b.bankAccounts.map((a) => ({
      _key: nextKey("bank"),
      branchKey: branchKeyById.get(b.id) ?? "",
      accountKind: a.accountKind,
      bankName: a.bankName,
      bankBranch: a.bankBranch ?? "",
      accountNumber: a.accountNumber,
      ifsc: a.ifsc ?? "",
      transactionCurrency: a.transactionCurrency ?? "",
    })),
  );

  return {
    ...base,
    name: org.name,
    alias: org.alias ?? "",
    contactPersonName: org.contactPersonName ?? "",
    contactPersonPhone: org.contactPersonPhone ?? "",
    contactPersonEmail: org.contactPersonEmail ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    branchId: org.branchId ?? "",
    isShipper: org.isShipper,
    isConsignee: org.isConsignee,
    isAgent: org.isAgent,
    isCarrier: org.isCarrier,
    isService: org.isService,
    isGlobal: org.isGlobal,
    defaultCurrency: org.defaultCurrency ?? "",
    gstNumber: org.kycDetail?.gstNumber ?? "",
    panNumber: org.kycDetail?.panNumber ?? "",
    tanNumber: org.kycDetail?.tanNumber ?? "",
    branches,
    bankAccounts,
    customerAccountInfo: org.customerAccountInfo
      ? {
          creditLimit: String(org.customerAccountInfo.creditLimit),
          isUnlimitedCredit: org.customerAccountInfo.isUnlimitedCredit,
          cashOnDelivery: org.customerAccountInfo.cashOnDelivery,
          includeWipShipmentInOverdue: org.customerAccountInfo.includeWipShipmentInOverdue,
          isCreditOnHold: org.customerAccountInfo.isCreditOnHold,
          creditOnHoldRemark: org.customerAccountInfo.creditOnHoldRemark ?? "",
          receivableCreditPeriodDays:
            org.customerAccountInfo.receivableCreditPeriodDays != null
              ? String(org.customerAccountInfo.receivableCreditPeriodDays)
              : "",
          customerGLCode: org.customerAccountInfo.customerGLCode ?? "",
          notificationEmails: org.customerAccountInfo.notificationEmails ?? "",
          currency: org.customerAccountInfo.currency ?? "",
          tdsReceivable: org.customerAccountInfo.tdsReceivable,
        }
      : null,
    vendorAccountInfo: org.vendorAccountInfo
      ? {
          creditLimit: String(org.vendorAccountInfo.creditLimit),
          isUnlimitedCredit: org.vendorAccountInfo.isUnlimitedCredit,
          payableCreditPeriodDays:
            org.vendorAccountInfo.payableCreditPeriodDays != null ? String(org.vendorAccountInfo.payableCreditPeriodDays) : "",
          dueDateCalculatedOn: org.vendorAccountInfo.dueDateCalculatedOn,
          vendorGLCode: org.vendorAccountInfo.vendorGLCode ?? "",
          notificationEmails: org.vendorAccountInfo.notificationEmails ?? "",
          currency: org.vendorAccountInfo.currency ?? "",
          isPaymentOnHold: org.vendorAccountInfo.isPaymentOnHold,
          tdsPayable: org.vendorAccountInfo.tdsPayable,
        }
      : null,
    billTypes: org.billTypes.map((bt) => ({
      _key: nextKey("billType"),
      billTypeId: bt.billTypeId,
      dueAfterDays: bt.dueAfterDays != null ? String(bt.dueAfterDays) : "",
      overrideCreditPeriod: bt.overrideCreditPeriod,
      billTo: bt.billTo,
      billToOrganizationId: bt.billToOrganizationId ?? "",
      clubCharges: bt.clubCharges,
    })),
  };
}
