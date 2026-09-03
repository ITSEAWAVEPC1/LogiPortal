/**
 * Stage 10b — demo dataset for the dashboard, reports, and (later) the 10d
 * performance pass. Separate from prisma/seed.ts, which is untouched.
 *
 *   ALLOW_DEMO_SEED=true npx tsx prisma/seed-demo.ts          # populate
 *   ALLOW_DEMO_SEED=true npx tsx prisma/seed-demo.ts --clean  # remove demo rows
 *
 * Every demo row is tagged so --clean removes exactly this set and nothing else:
 *   Organization       name starts "Demo · "
 *   Job / Quotation    sourceReference = "DEMO-SEED"
 *   Enquiry            rfqReason starts "[DEMO]"
 * Reference fields (referenceNo / refYear / refSequence) are left NULL so the
 * demo data never collides with real RFQ numbering.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Refusing to run without ALLOW_DEMO_SEED=true (and never in production).");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CLEAN = process.argv.includes("--clean");

// --- deterministic PRNG so re-runs produce a comparable shape ---------------
let seed = 20260903;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p: number) => rnd() < p;
const DAY = 86_400_000;

const ORG_NAMES = [
  "Meridian Exports", "Coral Shipping", "Blue Harbour Trading", "Everest Logistics",
  "Sunrise Impex", "Greenfield Commodities", "Delta Freight Co", "Northwind Traders",
  "Silk Route Cargo", "Pioneer Overseas", "Harb0ur Point Ltd", "Anchor & Co",
  "Vega Global Trade", "Orient Star Exports", "Falcon Freight", "Riverstone Imports",
  "Crestline Trading", "Monsoon Logistics",
] as const;
const SERVICE_TYPES = [
  "FREIGHT_FORWARDING", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "WAREHOUSING", "EXIM_CONSULTANCY",
] as const;
const INCOTERMS = ["EXW", "FOB", "CIF", "DDP", "DDU"] as const;
const CHARGE_CATEGORIES = ["FREIGHT", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "REIMBURSEMENT"] as const;
// rough relative weights per branch
const BRANCH_WEIGHT: Record<string, number> = {
  Mumbai: 190, Kolkata: 120, Chennai: 110, Surat: 90, Jogbani: 55, Raxaul: 55, Sounali: 45,
};

async function clean() {
  const jobs = await prisma.job.deleteMany({ where: { sourceReference: "DEMO-SEED" } });
  const quotes = await prisma.quotation.deleteMany({ where: { sourceReference: "DEMO-SEED" } });
  const enq = await prisma.enquiry.deleteMany({ where: { rfqReason: { startsWith: "[DEMO]" } } });
  const orgs = await prisma.organization.deleteMany({ where: { name: { startsWith: "Demo · " } } });
  console.log(
    `Removed demo rows — jobs ${jobs.count}, quotations ${quotes.count}, enquiries ${enq.count}, organizations ${orgs.count}.`,
  );
}

async function chunkedCreate<T>(
  model: { createMany: (args: { data: T[] }) => Promise<{ count: number }> },
  rows: T[],
  size = 300,
): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const res = await model.createMany({ data: rows.slice(i, i + size) });
    n += res.count;
  }
  return n;
}

async function main() {
  if (CLEAN) {
    await clean();
    return;
  }

  // idempotent-ish: wipe any previous demo run first
  await clean();

  const [branches, users] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, email: true, role: true } }),
  ]);
  const userByRole = (r: string) => users.find((u) => u.role === r)?.id ?? users[0].id;
  const adminId = userByRole("ADMIN");
  const salesId = userByRole("SALES");
  const doerId = userByRole("DOER");

  const now = Date.now();
  const START = now - 550 * DAY;
  const between = () => new Date(START + rnd() * (now - START));

  // --- organizations ---
  const orgIds: string[] = [];
  const orgRows: Prisma.OrganizationCreateManyInput[] = ORG_NAMES.map((name, i) => {
    const id = randomUUID();
    orgIds.push(id);
    return {
      id,
      name: `Demo · ${name}`,
      alias: "DEMOSEED",
      isActive: true,
      createdById: adminId,
      defaultCurrency: i % 6 === 0 ? "USD" : "INR",
      isConsignee: true,
      isShipper: true,
    };
  });
  await chunkedCreate(prisma.organization, orgRows);

  // --- accumulate rows ---
  const enquiryRows: Prisma.EnquiryCreateManyInput[] = [];
  const quotationRows: Prisma.QuotationCreateManyInput[] = [];
  const versionRows: Prisma.QuotationVersionCreateManyInput[] = [];
  const lineItemRows: Prisma.QuotationLineItemCreateManyInput[] = [];
  const quotationEnquiryRows: Prisma.QuotationEnquiryCreateManyInput[] = [];
  const jobRows: Prisma.JobCreateManyInput[] = [];

  const inProgressJobs: { id: string; branchId: string; shipmentType: "IMPORT" | "EXPORT"; createdAt: Date }[] = [];
  const completedJobIds: string[] = [];

  for (const branch of branches) {
    const target = BRANCH_WEIGHT[branch.name] ?? 60;
    for (let k = 0; k < target; k++) {
      const createdAt = between();
      const ageDays = (now - createdAt.getTime()) / DAY;
      const orgId = pick(orgIds);
      const shipmentType = chance(0.55) ? "IMPORT" : "EXPORT";
      const svcCount = int(1, 3);
      const serviceTypes = Array.from(new Set(Array.from({ length: svcCount }, () => pick(SERVICE_TYPES))));
      const incoterm = pick(INCOTERMS);
      const currency = orgRows.find((o) => o.id === orgId)?.defaultCurrency ?? "INR";
      const quotedTotal = Math.round(int(40, 2500) * 1000 * (currency === "USD" ? 0.012 : 1));

      // status skews with age
      let status: "WORKFLOW_IN_PROGRESS" | "COMPLETED" | "PENDING_REVIEW" | "NEEDS_CORRECTION" | "CANCELLED";
      if (ageDays > 120) status = chance(0.9) ? "COMPLETED" : chance(0.5) ? "CANCELLED" : "WORKFLOW_IN_PROGRESS";
      else if (ageDays > 45) status = chance(0.6) ? "COMPLETED" : "WORKFLOW_IN_PROGRESS";
      else status = chance(0.55) ? "WORKFLOW_IN_PROGRESS" : chance(0.5) ? "PENDING_REVIEW" : "NEEDS_CORRECTION";

      let expectedDeliveryDate: Date | null = null;
      let actualDeliveryDate: Date | null = null;
      if (status === "COMPLETED" || status === "WORKFLOW_IN_PROGRESS") {
        expectedDeliveryDate = new Date(createdAt.getTime() + int(20, 60) * DAY);
        if (status === "COMPLETED") {
          const slip = chance(0.7) ? int(-12, 3) : int(2, 28); // ~70% on-time
          actualDeliveryDate = new Date(expectedDeliveryDate.getTime() + slip * DAY);
        }
      }

      const origin = chance(0.75) ? "QUOTATION" : chance(0.8) ? "DIRECT" : "IMPORTED";
      const jobId = randomUUID();
      let quotationEnquiryId: string | null = null;

      if (origin === "QUOTATION") {
        const enquiryId = randomUUID();
        const quotationId = randomUUID();
        const versionId = randomUUID();
        const qeId = randomUUID();
        quotationEnquiryId = qeId;
        const enqCreatedAt = new Date(createdAt.getTime() - int(3, 20) * DAY);
        const quoCreatedAt = new Date(createdAt.getTime() - int(1, 10) * DAY);

        enquiryRows.push({
          id: enquiryId,
          status: "READY_FOR_QUOTATION",
          branchId: branch.id,
          organizationId: orgId,
          shipmentType,
          serviceTypes,
          rfqReason: "[DEMO] converted enquiry",
          doerId: salesId,
          createdAt: enqCreatedAt,
        });

        const lines = int(2, 4);
        let total = 0;
        for (let li = 0; li < lines; li++) {
          const amount = Math.round((quotedTotal / lines) * (0.6 + rnd() * 0.8));
          total += amount;
          lineItemRows.push({
            id: randomUUID(),
            quotationVersionId: versionId,
            category: pick(CHARGE_CATEGORIES),
            description: "Demo charge line",
            amount,
            currency,
            sortOrder: li,
          });
        }
        quotationRows.push({
          id: quotationId,
          status: "CONVERTED",
          organizationId: orgId,
          branchId: branch.id,
          createdById: salesId,
          currentVersionNumber: 1,
          sourceReference: "DEMO-SEED",
          sentAt: new Date(quoCreatedAt.getTime() + 1 * DAY),
          customerApproved: true,
          customerApprovedAt: new Date(quoCreatedAt.getTime() + 2 * DAY),
          convertedAt: createdAt,
          createdAt: quoCreatedAt,
        });
        versionRows.push({
          id: versionId,
          quotationId,
          versionNumber: 1,
          currency,
          totalAmount: total,
          createdById: salesId,
          approvedById: adminId,
          approvedAt: new Date(quoCreatedAt.getTime() + 1 * DAY),
          createdAt: quoCreatedAt,
        });
        quotationEnquiryRows.push({ id: qeId, quotationId, enquiryId });
      }

      jobRows.push({
        id: jobId,
        status,
        origin,
        branchId: branch.id,
        organizationId: orgId,
        shipmentType,
        serviceTypes,
        incoterm,
        quotationEnquiryId,
        createdById: doerId,
        chargesCurrency: currency,
        quotedTotal,
        expectedDeliveryDate,
        actualDeliveryDate,
        internalNotes: "[DEMO] seeded job",
        sourceReference: "DEMO-SEED",
        createdAt,
      });

      if (status === "WORKFLOW_IN_PROGRESS") {
        inProgressJobs.push({ id: jobId, branchId: branch.id, shipmentType, createdAt });
      } else if (status === "COMPLETED") {
        completedJobIds.push(jobId);
      }
    }
  }

  // --- extra funnel volume: enquiries that never convert + quotations that stall ---
  for (let i = 0; i < 220; i++) {
    const branch = pick(branches);
    enquiryRows.push({
      id: randomUUID(),
      status: pick(["OPEN", "DRAFT", "NEEDS_CORRECTION", "READY_FOR_QUOTATION"] as const),
      branchId: branch.id,
      organizationId: pick(orgIds),
      shipmentType: chance(0.5) ? "IMPORT" : "EXPORT",
      serviceTypes: [pick(SERVICE_TYPES)],
      rfqReason: "[DEMO] open enquiry",
      doerId: salesId,
      createdAt: between(),
    });
  }
  for (let i = 0; i < 130; i++) {
    const branch = pick(branches);
    const quotationId = randomUUID();
    const versionId = randomUUID();
    const created = between();
    const status = pick(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CUSTOMER_APPROVED"] as const);
    const total = int(50, 1800) * 1000;
    quotationRows.push({
      id: quotationId,
      status,
      organizationId: pick(orgIds),
      branchId: branch.id,
      createdById: salesId,
      currentVersionNumber: 1,
      sourceReference: "DEMO-SEED",
      sentAt: status === "SENT" || status === "CUSTOMER_APPROVED" ? new Date(created.getTime() + DAY) : null,
      customerApproved: status === "CUSTOMER_APPROVED",
      customerApprovedAt: status === "CUSTOMER_APPROVED" ? new Date(created.getTime() + 3 * DAY) : null,
      createdAt: created,
    });
    versionRows.push({
      id: versionId,
      quotationId,
      versionNumber: 1,
      currency: "INR",
      totalAmount: total,
      createdById: salesId,
      createdAt: created,
    });
    lineItemRows.push({
      id: randomUUID(),
      quotationVersionId: versionId,
      category: pick(CHARGE_CATEGORIES),
      description: "Demo charge line",
      amount: total,
      currency: "INR",
      sortOrder: 0,
    });
  }

  const counts = {
    enquiries: await chunkedCreate(prisma.enquiry, enquiryRows),
    quotations: await chunkedCreate(prisma.quotation, quotationRows),
    versions: await chunkedCreate(prisma.quotationVersion, versionRows),
    lineItems: await chunkedCreate(prisma.quotationLineItem, lineItemRows),
    quotationEnquiries: await chunkedCreate(prisma.quotationEnquiry, quotationEnquiryRows),
    jobs: await chunkedCreate(prisma.job, jobRows),
  };

  // --- workflow progress + audit for a slice of in-progress jobs -----------
  const templates = await prisma.workflowTemplate.findMany({
    where: { shipmentType: { in: ["IMPORT", "EXPORT"] } },
    select: {
      id: true,
      shipmentType: true,
      incotermKey: true,
      steps: { orderBy: { sortOrder: "asc" }, select: { id: true, stepKey: true, label: true, sortOrder: true } },
    },
  });
  const importTpl = templates.find((t) => t.shipmentType === "IMPORT" && t.incotermKey === "EXW") ?? templates[0];
  const exportTpl = templates.find((t) => t.shipmentType === "EXPORT" && t.incotermKey === "CIF") ?? templates[0];

  const progressRows: Prisma.JobWorkflowProgressCreateManyInput[] = [];
  const auditRows: Prisma.JobAuditLogCreateManyInput[] = [];
  const backdate: { jobId: string; at: Date }[] = [];

  for (const job of inProgressJobs.slice(0, 40)) {
    const tpl = job.shipmentType === "IMPORT" ? importTpl : exportTpl;
    if (!tpl || tpl.steps.length === 0) continue;
    const doneUpto = int(2, tpl.steps.length - 2);
    const stageSince = new Date(job.createdAt.getTime() + int(5, 40) * DAY);
    backdate.push({ jobId: job.id, at: stageSince > new Date(now) ? new Date(now - int(1, 20) * DAY) : stageSince });

    tpl.steps.forEach((step, idx) => {
      const status = idx < doneUpto ? "COMPLETED" : idx === doneUpto ? "IN_PROGRESS" : "PENDING";
      progressRows.push({
        id: randomUUID(),
        jobId: job.id,
        templateId: tpl.id,
        stepId: step.id,
        stepKey: step.stepKey,
        label: step.label,
        sortOrder: step.sortOrder,
        status,
        completedById: status === "COMPLETED" ? doerId : null,
        completedAt: status === "COMPLETED" ? new Date(job.createdAt.getTime() + (idx + 1) * 2 * DAY) : null,
      });
      if (status === "COMPLETED" && idx % 3 === 0) {
        auditRows.push({
          jobId: job.id,
          actorId: doerId,
          action: "workflow.step.completed",
          stepKey: step.stepKey,
          createdAt: new Date(job.createdAt.getTime() + (idx + 1) * 2 * DAY),
        });
      }
    });
  }
  for (const jobId of completedJobIds.slice(0, 120)) {
    auditRows.push({ jobId, actorId: doerId, action: "job.completed" });
  }

  const progressCount = await chunkedCreate(prisma.jobWorkflowProgress, progressRows);
  const auditCount = await chunkedCreate(prisma.jobAuditLog, auditRows);

  // backdate the progress rows' updatedAt so the ageing report shows real spread
  for (const b of backdate) {
    await prisma.$executeRawUnsafe(
      `UPDATE "job_workflow_progress" SET "updatedAt" = $1 WHERE "jobId" = $2`,
      b.at,
      b.jobId,
    );
  }

  console.log("Demo seed complete:", {
    organizations: orgRows.length,
    ...counts,
    workflowProgress: progressCount,
    auditLogs: auditCount,
    inProgress: inProgressJobs.length,
    completed: completedJobIds.length,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
