/**
 * Stage 10b one-shot backfill for Job.expectedDeliveryDate / actualDeliveryDate.
 *
 * Idempotent: only fills columns that are currently NULL. Safe to run twice.
 * Run locally after the 10b migration, and once on the deployed DB.
 *
 *   ALLOW_BACKFILL=true npx tsx prisma/backfill/20260903_delivery_dates.ts
 *
 * Derivation (mirrors src/lib/workflow/delivery-dates.ts):
 *   expectedDeliveryDate <- the ETA-at-POD step's data.date
 *       import: eta_discharge_port   export: export_eta_to_pod
 *   actualDeliveryDate (COMPLETED jobs only) <- the delivery step's data.date,
 *       falling back to that step's completedAt, then the job's updatedAt
 *       import: delivered_status     export: export_do_and_delivery
 */
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../src/generated/prisma/client";
import { DELIVERY_STEP_KEYS } from "../../src/lib/workflow/delivery-dates";

if (process.env.ALLOW_BACKFILL !== "true") {
  console.error("Refusing to run without ALLOW_BACKFILL=true");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const jobs = await prisma.job.findMany({
    where: {
      OR: [{ expectedDeliveryDate: null }, { actualDeliveryDate: null, status: "COMPLETED" }],
      workflowProgress: { some: {} },
    },
    select: {
      id: true,
      status: true,
      shipmentType: true,
      updatedAt: true,
      expectedDeliveryDate: true,
      actualDeliveryDate: true,
      workflowProgress: { select: { stepKey: true, data: true, completedAt: true } },
    },
  });

  let expectedFilled = 0;
  let actualFilled = 0;

  for (const job of jobs) {
    const keys = DELIVERY_STEP_KEYS[job.shipmentType];
    const byKey = new Map(job.workflowProgress.map((s) => [s.stepKey, s]));
    const patch: { expectedDeliveryDate?: Date; actualDeliveryDate?: Date } = {};

    if (!job.expectedDeliveryDate) {
      const eta = byKey.get(keys.expected);
      const d = parseDate((eta?.data as Record<string, unknown> | null)?.["date"]);
      if (d) patch.expectedDeliveryDate = d;
    }

    if (!job.actualDeliveryDate && job.status === "COMPLETED") {
      const step = byKey.get(keys.actual);
      const d =
        parseDate((step?.data as Record<string, unknown> | null)?.["date"]) ??
        step?.completedAt ??
        job.updatedAt;
      if (d) patch.actualDeliveryDate = d;
    }

    if (patch.expectedDeliveryDate || patch.actualDeliveryDate) {
      await prisma.job.update({ where: { id: job.id }, data: patch });
      if (patch.expectedDeliveryDate) expectedFilled++;
      if (patch.actualDeliveryDate) actualFilled++;
    }
  }

  console.log(
    `Backfill done — scanned ${jobs.length} job(s); filled expectedDeliveryDate on ${expectedFilled}, actualDeliveryDate on ${actualFilled}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
