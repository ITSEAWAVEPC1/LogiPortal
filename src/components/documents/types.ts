// Client-side shapes for the document repository, mirroring serializeDocument
// in src/lib/documents/document-service.ts.

export type DocumentKindValue =
  | "HBL"
  | "MBL"
  | "FREIGHT_CERTIFICATE"
  | "DELIVERY_ORDER"
  | "INVOICE"
  | "OTHER";

export type DocumentStatusValue = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type DocumentGenStatus = "NOT_APPLICABLE" | "SUCCEEDED" | "FAILED";

export interface DocumentVersionCard {
  id: string;
  versionNumber: number;
  fileName: string;
  contentType: string;
  byteSize: number;
  generationStatus: DocumentGenStatus;
  generationError: string | null;
  generationAttempts: number;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  isCurrent: boolean;
}

export interface DocumentCard {
  id: string;
  ref: string;
  jobId: string;
  jobRef: string;
  organizationName: string;
  kind: DocumentKindValue;
  origin: "GENERATED" | "UPLOADED";
  title: string;
  isFinancial: boolean;
  status: DocumentStatusValue;
  sharedWithCustomer: boolean;
  isActive: boolean;
  currentVersionNumber: number;
  currentVersionId: string | null;
  currentGenerationStatus: DocumentGenStatus | null;
  jobWorkflowProgressId: string | null;
  documentTypeCode: string;
  documentTypeName: string;
  createdBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersionCard[];
}

export interface DocumentTypeOption {
  id: string;
  code: string;
  name: string;
  kind: DocumentKindValue;
  isFinancial: boolean;
  isGeneratable: boolean;
  customerVisibleDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export const DOCUMENT_KIND_LABEL: Record<DocumentKindValue, string> = {
  HBL: "HBL",
  MBL: "MBL",
  FREIGHT_CERTIFICATE: "Freight Certificate",
  DELIVERY_ORDER: "Delivery Order",
  INVOICE: "Invoice",
  OTHER: "Other",
};

export function documentStatusVariant(
  status: DocumentStatusValue,
): "success" | "warning" | "danger" | "active" | "pending" | "neutral" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING_APPROVAL":
      return "active";
    case "REJECTED":
      return "danger";
    default:
      return "pending";
  }
}
