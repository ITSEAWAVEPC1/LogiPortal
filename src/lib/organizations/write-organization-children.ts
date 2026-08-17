import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationDetailInput } from "@/lib/validation/organization-detail";

type Tx = Prisma.TransactionClient;

export interface OrganizationSectionPermissions {
  canEditBranches: boolean;
  canEditBilling: boolean;
  canEditAccountInfo: boolean;
}

// Ensures exactly one contact is flagged isPrimary per branch (Customer
// Master v2 acceptance criteria) — auto-promotes the first contact if none
// are flagged, and demotes every flagged contact after the first if more
// than one was submitted, rather than rejecting the whole save.
function normalizePrimaryContact<T extends { isPrimary?: boolean }>(contacts: T[]): T[] {
  const primaryCount = contacts.filter((c) => c.isPrimary).length;
  if (primaryCount === 0 && contacts.length > 0) {
    return contacts.map((c, i) => (i === 0 ? { ...c, isPrimary: true } : c));
  }
  if (primaryCount > 1) {
    let seenPrimary = false;
    return contacts.map((c) => {
      if (!c.isPrimary) return c;
      if (seenPrimary) return { ...c, isPrimary: false };
      seenPrimary = true;
      return c;
    });
  }
  return contacts;
}

/**
 * Writes an Organization's Branches (+ their Addresses/Contacts/Account
 * Managers/Bank Accounts), Bill Types, and Account Info within an existing
 * transaction. Replace-children strategy: each writable section is deleted
 * and recreated wholesale from the payload rather than diffed row-by-row —
 * safe because nothing outside an Organization's own subtree references
 * these child ids yet (see docs/stage-checklists/customer-master-v2.md).
 *
 * Sections the caller's role isn't permitted to edit (per
 * OrganizationSectionPermissions, computed from field-permissions.ts) are
 * left completely untouched — not wiped — so a role with view-only Billing
 * access can still update Branches in the same save without losing Bill
 * Types it never had permission to submit.
 */
export async function writeOrganizationChildren(
  tx: Tx,
  organizationId: string,
  data: OrganizationDetailInput,
  permissions: OrganizationSectionPermissions,
) {
  if (permissions.canEditBranches) {
    await tx.organizationBranch.deleteMany({ where: { organizationId } });
    for (const branch of data.branches) {
      const contacts = normalizePrimaryContact(branch.contacts);
      await tx.organizationBranch.create({
        data: {
          organizationId,
          branchName: branch.branchName,
          address: branch.address || null,
          isDefault: branch.isDefault,
          isDeactivated: branch.isDeactivated,
          country: branch.country || null,
          state: branch.state || null,
          city: branch.city || null,
          postalCode: branch.postalCode || null,
          telephone: branch.telephone || null,
          fax: branch.fax || null,
          website: branch.website || null,
          email: branch.email || null,
          salesPersonId: branch.salesPersonId || null,
          lobWise: branch.lobWise,
          collectionExecutiveId: branch.collectionExecutiveId || null,
          taxableType: branch.taxableType || "Standard",
          addresses: {
            create: branch.addresses.map((a) => ({
              addressType: a.addressType,
              name: a.name || null,
              address: a.address || null,
              city: a.city || null,
              postalCode: a.postalCode || null,
              state: a.state || null,
              telephone: a.telephone || null,
              fax: a.fax || null,
              email: a.email || null,
            })),
          },
          contacts: {
            create: contacts.map((c) => ({
              contactName: c.contactName,
              titleDesignation: c.titleDesignation || null,
              department: c.department || null,
              mobile: c.mobile || null,
              telephone: c.telephone || null,
              email: c.email || null,
              isPrimary: c.isPrimary ?? false,
            })),
          },
          accountManagers: {
            create: branch.accountManagers.map((am) => ({
              forCategory: am.forCategory,
              managerUserId: am.managerUserId || null,
            })),
          },
          bankAccounts: {
            create: branch.bankAccounts.map((b) => ({
              accountKind: b.accountKind,
              bankName: b.bankName,
              bankBranch: b.bankBranch || null,
              accountNumber: b.accountNumber,
              ifsc: b.ifsc || null,
              transactionCurrency: b.accountKind === "RECEIVABLE" ? b.transactionCurrency || null : null,
            })),
          },
        },
      });
    }
  }

  if (permissions.canEditBilling) {
    await tx.organizationBillType.deleteMany({ where: { organizationId } });
    for (const bt of data.billTypes) {
      await tx.organizationBillType.create({
        data: {
          organizationId,
          billTypeId: bt.billTypeId,
          dueAfterDays: bt.dueAfterDays ?? null,
          overrideCreditPeriod: bt.overrideCreditPeriod,
          billTo: bt.billTo,
          billToOrganizationId: bt.billTo === "OTHER" ? bt.billToOrganizationId || null : null,
          clubCharges: bt.clubCharges,
        },
      });
    }
  }

  if (permissions.canEditAccountInfo) {
    if (data.customerAccountInfo) {
      const info = data.customerAccountInfo;
      await tx.customerAccountInfo.upsert({
        where: { organizationId },
        create: {
          organizationId,
          creditLimit: info.creditLimit,
          isUnlimitedCredit: info.isUnlimitedCredit,
          cashOnDelivery: info.cashOnDelivery,
          includeWipShipmentInOverdue: info.includeWipShipmentInOverdue,
          isCreditOnHold: info.isCreditOnHold,
          creditOnHoldRemark: info.creditOnHoldRemark || null,
          receivableCreditPeriodDays: info.receivableCreditPeriodDays ?? null,
          customerGLCode: info.customerGLCode || null,
          notificationEmails: info.notificationEmails || null,
          currency: info.currency || null,
          tdsReceivable: info.tdsReceivable,
        },
        update: {
          creditLimit: info.creditLimit,
          isUnlimitedCredit: info.isUnlimitedCredit,
          cashOnDelivery: info.cashOnDelivery,
          includeWipShipmentInOverdue: info.includeWipShipmentInOverdue,
          isCreditOnHold: info.isCreditOnHold,
          creditOnHoldRemark: info.creditOnHoldRemark || null,
          receivableCreditPeriodDays: info.receivableCreditPeriodDays ?? null,
          customerGLCode: info.customerGLCode || null,
          notificationEmails: info.notificationEmails || null,
          currency: info.currency || null,
          tdsReceivable: info.tdsReceivable,
        },
      });
    } else {
      await tx.customerAccountInfo.deleteMany({ where: { organizationId } });
    }

    if (data.vendorAccountInfo) {
      const info = data.vendorAccountInfo;
      await tx.vendorAccountInfo.upsert({
        where: { organizationId },
        create: {
          organizationId,
          creditLimit: info.creditLimit,
          isUnlimitedCredit: info.isUnlimitedCredit,
          payableCreditPeriodDays: info.payableCreditPeriodDays ?? null,
          dueDateCalculatedOn: info.dueDateCalculatedOn,
          vendorGLCode: info.vendorGLCode || null,
          notificationEmails: info.notificationEmails || null,
          currency: info.currency || null,
          isPaymentOnHold: info.isPaymentOnHold,
          tdsPayable: info.tdsPayable,
        },
        update: {
          creditLimit: info.creditLimit,
          isUnlimitedCredit: info.isUnlimitedCredit,
          payableCreditPeriodDays: info.payableCreditPeriodDays ?? null,
          dueDateCalculatedOn: info.dueDateCalculatedOn,
          vendorGLCode: info.vendorGLCode || null,
          notificationEmails: info.notificationEmails || null,
          currency: info.currency || null,
          isPaymentOnHold: info.isPaymentOnHold,
          tdsPayable: info.tdsPayable,
        },
      });
    } else {
      await tx.vendorAccountInfo.deleteMany({ where: { organizationId } });
    }
  }
}
