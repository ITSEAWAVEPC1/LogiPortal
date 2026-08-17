// Client-side form shapes for the Customer Master v2 Organization editor.
// `_key` fields are stable React list keys only — never sent to the API.

export type FieldAccessLevel = "NONE" | "VIEW" | "EDIT";

export interface OrganizationFieldAccess {
  accountInfo: FieldAccessLevel;
  billing: FieldAccessLevel;
  branches: FieldAccessLevel;
  addresses: FieldAccessLevel;
  contacts: FieldAccessLevel;
}

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

export interface BillTypeOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface OrgOption {
  id: string;
  name: string;
}

export interface BranchAddressForm {
  _key: string;
  addressType: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  state: string;
  telephone: string;
  fax: string;
  email: string;
}

export interface BranchContactForm {
  _key: string;
  contactName: string;
  titleDesignation: string;
  department: string;
  mobile: string;
  telephone: string;
  email: string;
  isPrimary: boolean;
}

export interface BranchAccountManagerForm {
  _key: string;
  forCategory: string;
  managerUserId: string;
}

export type BankAccountKind = "PAYABLE" | "RECEIVABLE";

export interface BankAccountForm {
  _key: string;
  branchKey: string; // OrganizationBranchForm._key this bank account belongs to
  accountKind: BankAccountKind;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifsc: string;
  transactionCurrency: string;
}

export interface OrganizationBranchForm {
  _key: string;
  branchName: string;
  address: string;
  isDefault: boolean;
  isDeactivated: boolean;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  telephone: string;
  fax: string;
  website: string;
  email: string;
  salesPersonId: string;
  lobWise: boolean;
  collectionExecutiveId: string;
  taxableType: string;
  addresses: BranchAddressForm[];
  contacts: BranchContactForm[];
  accountManagers: BranchAccountManagerForm[];
}

export type DueDateBasis = "TRANSACTION_DATE" | "INVOICE_DATE" | "BILL_DATE";

export interface CustomerAccountInfoForm {
  creditLimit: string;
  isUnlimitedCredit: boolean;
  cashOnDelivery: boolean;
  includeWipShipmentInOverdue: boolean;
  isCreditOnHold: boolean;
  creditOnHoldRemark: string;
  receivableCreditPeriodDays: string;
  customerGLCode: string;
  notificationEmails: string;
  currency: string;
  tdsReceivable: boolean;
}

export interface VendorAccountInfoForm {
  creditLimit: string;
  isUnlimitedCredit: boolean;
  payableCreditPeriodDays: string;
  dueDateCalculatedOn: DueDateBasis;
  vendorGLCode: string;
  notificationEmails: string;
  currency: string;
  isPaymentOnHold: boolean;
  tdsPayable: boolean;
}

export type BillToType = "DIRECT" | "OTHER";
export type ClubChargesOption = "NO_GROUPING" | "GROUP_BY_SHIPMENT" | "GROUP_BY_JOB";

export interface OrganizationBillTypeForm {
  _key: string;
  billTypeId: string;
  dueAfterDays: string;
  overrideCreditPeriod: boolean;
  billTo: BillToType;
  billToOrganizationId: string;
  clubCharges: ClubChargesOption;
}

export interface OrganizationFormState {
  name: string;
  alias: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  city: string;
  state: string;
  branchId: string;
  isShipper: boolean;
  isConsignee: boolean;
  isAgent: boolean;
  isCarrier: boolean;
  isService: boolean;
  isGlobal: boolean;
  defaultCurrency: string;
  gstNumber: string;
  panNumber: string;
  tanNumber: string;
  branches: OrganizationBranchForm[];
  bankAccounts: BankAccountForm[];
  customerAccountInfo: CustomerAccountInfoForm | null;
  vendorAccountInfo: VendorAccountInfoForm | null;
  billTypes: OrganizationBillTypeForm[];
}

let keySeq = 0;
export function nextKey(prefix: string): string {
  keySeq += 1;
  return `${prefix}-${keySeq}`;
}

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CNY"];

export const EMPTY_CUSTOMER_ACCOUNT_INFO: CustomerAccountInfoForm = {
  creditLimit: "0",
  isUnlimitedCredit: false,
  cashOnDelivery: false,
  includeWipShipmentInOverdue: false,
  isCreditOnHold: false,
  creditOnHoldRemark: "",
  receivableCreditPeriodDays: "",
  customerGLCode: "",
  notificationEmails: "",
  currency: "",
  tdsReceivable: false,
};

export const EMPTY_VENDOR_ACCOUNT_INFO: VendorAccountInfoForm = {
  creditLimit: "0",
  isUnlimitedCredit: false,
  payableCreditPeriodDays: "",
  dueDateCalculatedOn: "TRANSACTION_DATE",
  vendorGLCode: "",
  notificationEmails: "",
  currency: "",
  isPaymentOnHold: false,
  tdsPayable: false,
};

export function emptyBranch(): OrganizationBranchForm {
  return {
    _key: nextKey("branch"),
    branchName: "",
    address: "",
    isDefault: false,
    isDeactivated: false,
    country: "",
    state: "",
    city: "",
    postalCode: "",
    telephone: "",
    fax: "",
    website: "",
    email: "",
    salesPersonId: "",
    lobWise: false,
    collectionExecutiveId: "",
    taxableType: "Standard",
    addresses: [],
    contacts: [],
    accountManagers: [],
  };
}

export function emptyAddress(): BranchAddressForm {
  return {
    _key: nextKey("address"),
    addressType: "Delivery",
    name: "",
    address: "",
    city: "",
    postalCode: "",
    state: "",
    telephone: "",
    fax: "",
    email: "",
  };
}

export function emptyContact(): BranchContactForm {
  return {
    _key: nextKey("contact"),
    contactName: "",
    titleDesignation: "",
    department: "",
    mobile: "",
    telephone: "",
    email: "",
    isPrimary: false,
  };
}

export function emptyAccountManager(): BranchAccountManagerForm {
  return { _key: nextKey("accountManager"), forCategory: "", managerUserId: "" };
}

export function emptyBankAccount(branchKey: string): BankAccountForm {
  return {
    _key: nextKey("bank"),
    branchKey,
    accountKind: "PAYABLE",
    bankName: "",
    bankBranch: "",
    accountNumber: "",
    ifsc: "",
    transactionCurrency: "",
  };
}

export function emptyBillType(): OrganizationBillTypeForm {
  return {
    _key: nextKey("billType"),
    billTypeId: "",
    dueAfterDays: "",
    overrideCreditPeriod: false,
    billTo: "DIRECT",
    billToOrganizationId: "",
    clubCharges: "NO_GROUPING",
  };
}

export function emptyOrganizationForm(): OrganizationFormState {
  return {
    name: "",
    alias: "",
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
    city: "",
    state: "",
    branchId: "",
    isShipper: false,
    isConsignee: false,
    isAgent: false,
    isCarrier: false,
    isService: false,
    isGlobal: false,
    defaultCurrency: "",
    gstNumber: "",
    panNumber: "",
    tanNumber: "",
    branches: [],
    bankAccounts: [],
    customerAccountInfo: null,
    vendorAccountInfo: null,
    billTypes: [],
  };
}
