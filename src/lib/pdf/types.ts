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

// ---------------------------------------------------------------------------
// Stage 7 — document PDF data shapes.
//
// Plain, flat, no Prisma types (same convention as QuotationPdfData). One
// shape per DocumentKind, discriminated on `kind`. build-document-data.ts
// produces these from a Job; the same shape is what a DocumentVersion's
// sourceSnapshot stores and what DocumentHtmlPreview renders on a
// generation failure.
// ---------------------------------------------------------------------------

export interface DocPartyBlock {
  name: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
}

export interface DocContainerRow {
  containerNumber: string | null;
  sealNumber: string | null;
  containerType: string | null;
  count: number | null;
  grossWeight: number | null;
  netWeight: number | null;
  packageCount: number | null;
}

export interface DocRouting {
  placeOfReceipt: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  placeOfDelivery: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  shippingLineName: string | null;
  cfsName: string | null;
}

export interface DocumentPdfBase {
  ref: string; // DOC-YYYY-####
  jobRef: string; // JOB-YYYY-####
  title: string;
  generatedAt: string; // ISO
  organizationName: string;
  branchName: string;
  shipmentType: string;
  incoterm: string | null;
  shipper: DocPartyBlock;
  consignee: DocPartyBlock;
  notifyParty: DocPartyBlock;
  routing: DocRouting;
  containers: DocContainerRow[];
  totalGrossWeight: number | null;
  totalNetWeight: number | null;
  totalPackages: number | null;
  volumeCbm: number | null;
  commodity: string | null;
  hsCode: string | null;
}

export interface HblPdfData extends DocumentPdfBase {
  kind: "HBL";
  hblNumber: string | null;
  hblDate: string | null;
}

export interface MblPdfData extends DocumentPdfBase {
  kind: "MBL";
  mblNumber: string | null;
  mblDate: string | null;
  blType: string | null;
  blNumber: string | null;
  blDate: string | null;
}

export interface DeliveryOrderPdfData extends DocumentPdfBase {
  kind: "DELIVERY_ORDER";
  deliveryOrderDate: string | null;
  freeDaysAtPod: number | null;
}

export interface FreightCertificatePdfData extends DocumentPdfBase {
  kind: "FREIGHT_CERTIFICATE";
  certificateDate: string | null;
  fcShipperName: string | null;
  fcConsigneeName: string | null;
  fcPortOfLoading: string | null;
  fcPortOfDischarge: string | null;
  hblNumberDate: string | null;
  mblNumberDate: string | null;
  oceanFreightUsd: number | null;
  exWorksUsd: number | null;
}

export interface InvoiceLineRow {
  category: string;
  description: string;
  amount: number;
  currency: string;
}

export interface InvoicePdfData extends DocumentPdfBase {
  kind: "INVOICE";
  invoiceCurrency: string;
  lineItems: InvoiceLineRow[];
  total: number;
}

export type DocumentPdfData =
  | HblPdfData
  | MblPdfData
  | DeliveryOrderPdfData
  | FreightCertificatePdfData
  | InvoicePdfData;
