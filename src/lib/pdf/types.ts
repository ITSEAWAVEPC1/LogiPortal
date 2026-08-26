export interface QuotationPdfLineItem {
  id: string;
  category: "FREIGHT" | "CUSTOMS_CLEARANCE" | "TRANSPORTATION" | "REIMBURSEMENT";
  description: string;
  rate: number | null;
  quantity: number | null;
  amount: number;
  currency: string;
}

export interface QuotationPdfEnquiry {
  id: string;
  ref: string;
  shipmentType: string | null;
  serviceTypes: string[];
}

export interface QuotationPdfData {
  id: string;
  ref: string;
  status: string;
  organizationName: string;
  organizationCity: string | null;
  organizationState: string | null;
  branchName: string;
  createdByName: string;
  createdAt: string;
  versionNumber: number;
  currency: string;
  totalAmount: number;
  approvedAt: string | null;
  enquiries: QuotationPdfEnquiry[];
  lineItems: QuotationPdfLineItem[];
}
