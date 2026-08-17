import type { Prisma } from "@/generated/prisma/client";

// Full nested shape for the Customer Master v2 detail editor. The plain
// list/combobox uses like `/api/customers?q=` intentionally keep their own
// lighter include (kycDetail + branch) — this is only for GET /api/customers/[id]
// and the POST/PATCH responses that need to hand the client back everything
// it just wrote.
export const organizationDetailInclude = {
  kycDetail: true,
  branch: { select: { id: true, name: true } },
  customerAccountInfo: true,
  vendorAccountInfo: true,
  billTypes: { include: { billType: true, billToOrganization: { select: { id: true, name: true } } } },
  branches: {
    include: {
      addresses: true,
      contacts: true,
      accountManagers: { include: { manager: { select: { id: true, name: true } } } },
      bankAccounts: true,
      salesPerson: { select: { id: true, name: true } },
      collectionExecutive: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OrganizationInclude;

export type OrganizationDetail = Prisma.OrganizationGetPayload<{ include: typeof organizationDetailInclude }>;
