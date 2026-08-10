import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getFieldAccessMap, JOB_FIELD_GROUPS } from "@/lib/permissions/field-permissions";

// Fixture data standing in for a real Job record — the Job entity doesn't
// exist until Stage 4. This route exists purely to prove the field-permission
// mechanism (src/lib/permissions/field-permissions.ts) enforces access
// server-side, per docs/platform-development-plan.md Section 4.3 / Stage 0's
// acceptance criteria.
const FIXTURE_JOB: Record<string, unknown> = {
  shipperConsigneeNotify: {
    shipper: "Acme Traders Pvt Ltd",
    consignee: "Nile Imports LLC",
    notifyParty: "Nile Imports LLC",
  },
  portVesselContainer: {
    pol: "Nhava Sheva (INNSA)",
    pod: "Jebel Ali (AEJEA)",
    vessel: "MSC AURORA",
    containerNo: "MSCU1234567",
  },
  workflowStatus: {
    currentStep: "Vessel Sail Date",
    status: "In Transit",
  },
  charges: {
    freightCharges: 125000,
    customsClearanceCharges: 18500,
    transportCharges: 9000,
  },
  dutyPayment: {
    liability: "Consignee account",
    dutyAmount: 42000,
    paidBy: "Consignee",
  },
  internalNotes: {
    notes: "Customer requested early ETA confirmation; awaiting shipping line reply.",
  },
  documents: {
    hbl: "HBL-2026-00123.pdf",
    mbl: "MBL-2026-00098.pdf",
  },
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = session.user;
  const accessMap = await getFieldAccessMap(role, "job");

  const fields: Record<string, { access: string; data?: unknown }> = {};
  for (const group of JOB_FIELD_GROUPS) {
    const access = accessMap[group] ?? "NONE";
    fields[group] = access === "NONE" ? { access } : { access, data: FIXTURE_JOB[group] };
  }

  return NextResponse.json({ role, resource: "job", fields });
}
