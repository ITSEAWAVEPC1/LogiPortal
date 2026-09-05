import type { Prisma } from "@/generated/prisma/client";
import type { EnquiryAutosaveInput } from "@/lib/validation/enquiry";

// Shared write path for both the lenient autosave/edit PATCH and the strict
// submit transition — same "upsert parent, replace children wholesale" shape
// for freightDetail/customsDetail's repeatable arrays (packages/commodityLines)
// as the Quotation line-items PUT route. Must run inside a transaction.
export async function persistEnquiryDraft(tx: Prisma.TransactionClient, id: string, data: EnquiryAutosaveInput) {
  const updated = await tx.enquiry.update({
    where: { id },
    data: {
      branchId: data.branchId,
      organizationId: data.organizationId,
      contactPersonName: data.contactPersonName,
      contactPersonPhone: data.contactPersonPhone,
      contactPersonEmail: data.contactPersonEmail,
      shipmentType: data.shipmentType,
      serviceTypes: data.serviceTypes,
      rfqReason: data.rfqReason,
    },
  });

  if (data.freightDetail) {
    const { packages, ...freightScalar } = data.freightDetail;
    const freightDetail = await tx.enquiryFreightDetail.upsert({
      where: { enquiryId: id },
      create: { enquiryId: id, ...freightScalar },
      update: { ...freightScalar },
    });
    if (packages) {
      await tx.enquiryFreightPackage.deleteMany({ where: { enquiryFreightDetailId: freightDetail.id } });
      if (packages.length > 0) {
        await tx.enquiryFreightPackage.createMany({
          data: packages.map((p, index) => ({ enquiryFreightDetailId: freightDetail.id, ...p, sortOrder: index })),
        });
      }
    }
  }
  if (data.customsDetail) {
    const { commodityLines, ...customsScalar } = data.customsDetail;
    const customsDetail = await tx.enquiryCustomsDetail.upsert({
      where: { enquiryId: id },
      create: { enquiryId: id, ...customsScalar },
      update: { ...customsScalar },
    });
    if (commodityLines) {
      await tx.enquiryCommodityLine.deleteMany({ where: { enquiryCustomsDetailId: customsDetail.id } });
      if (commodityLines.length > 0) {
        await tx.enquiryCommodityLine.createMany({
          data: commodityLines.map((l, index) => ({ enquiryCustomsDetailId: customsDetail.id, ...l, sortOrder: index })),
        });
      }
    }
  }
  if (data.transportDetail) {
    await tx.enquiryTransportDetail.upsert({
      where: { enquiryId: id },
      create: { enquiryId: id, ...data.transportDetail },
      update: { ...data.transportDetail },
    });
  }

  return updated;
}
