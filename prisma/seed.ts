import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Role, type FieldAccessLevel } from "../src/generated/prisma/client";
import { IMPORT_WORKFLOW_TEMPLATES } from "../src/lib/workflow/import-tracks";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BRANCHES = ["Mumbai", "Kolkata", "Surat", "Jogbani", "Raxaul", "Sounali", "Chennai"];

const TEST_PASSWORD = "password123";

const TEST_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@test.seawave.com", name: "Test Admin", role: "ADMIN" },
  { email: "branchmgr@test.seawave.com", name: "Test Branch Manager", role: "BRANCH_MANAGER" },
  { email: "doer@test.seawave.com", name: "Test Doer", role: "DOER" },
  { email: "sales@test.seawave.com", name: "Test Sales", role: "SALES" },
  { email: "accounts@test.seawave.com", name: "Test Accounts", role: "ACCOUNTS" },
  { email: "customer@test.seawave.com", name: "Test Customer", role: "CUSTOMER" },
];

// Section 4.3 (Job detail screen field-level permissions), condensed to
// NONE/VIEW/EDIT. Row-level nuance ("own entries only", "if their liability")
// is not encoded here — it needs the real Job entity (Stage 4/6).
const FIELD_PERMISSIONS: Record<Role, Record<string, FieldAccessLevel>> = {
  ADMIN: {
    shipperConsigneeNotify: "EDIT",
    portVesselContainer: "EDIT",
    workflowStatus: "EDIT",
    charges: "EDIT",
    dutyPayment: "EDIT",
    internalNotes: "EDIT",
    documents: "EDIT",
  },
  BRANCH_MANAGER: {
    shipperConsigneeNotify: "EDIT",
    portVesselContainer: "EDIT",
    workflowStatus: "EDIT",
    charges: "EDIT",
    dutyPayment: "EDIT",
    internalNotes: "EDIT",
    documents: "EDIT",
  },
  DOER: {
    shipperConsigneeNotify: "EDIT",
    portVesselContainer: "EDIT",
    workflowStatus: "EDIT",
    charges: "VIEW",
    dutyPayment: "VIEW",
    internalNotes: "EDIT",
    documents: "EDIT",
  },
  SALES: {
    shipperConsigneeNotify: "VIEW",
    portVesselContainer: "VIEW",
    workflowStatus: "VIEW",
    charges: "VIEW",
    dutyPayment: "NONE",
    internalNotes: "NONE",
    documents: "VIEW",
  },
  ACCOUNTS: {
    shipperConsigneeNotify: "VIEW",
    portVesselContainer: "VIEW",
    workflowStatus: "VIEW",
    charges: "EDIT",
    dutyPayment: "EDIT",
    internalNotes: "NONE",
    documents: "EDIT",
  },
  CUSTOMER: {
    shipperConsigneeNotify: "VIEW",
    portVesselContainer: "VIEW",
    workflowStatus: "VIEW",
    charges: "VIEW",
    dutyPayment: "VIEW",
    internalNotes: "NONE",
    documents: "VIEW",
  },
};

// Customer Master v2 — Billing tab's Bill Type master, seeded from the names
// visible in docs/customer-master-competitor-reference.pdf's Billing screen
// (dropdown wasn't scrolled further, so this may not be the full list).
// Preserved verbatim, including the source system's own spelling.
const BILL_TYPE_NAMES = [
  "DEBIT NOTE CLEARANCE",
  "EXPORT E-INVOICE",
  "EXPORT GEN INV JBN-E-INVOICE",
  "EXPORT INVOICE JGN",
  "EXPORT REIMBURESEMENT E-INVOICE",
  "EXPORT-FREIGHT INVOICE",
  "Gen Debit Note",
  "GEN-FREIGHT INVOICE",
  "GENERAL E-INVOICE",
  "GENERAL REIMBURSEMENT E-INVOICE",
  "IMP/EXP REIMBURESEMENT TAXABLE E-INVOICE",
  "IMPORT E-INVOICE",
  "IMPORT REIMBURESEMENT E-INVOICE",
  "IMPORT-FREIGHT INVOICE",
  "KOL-IMP INVOICE- E-INVOICE",
  "KOL-TRANSPORT INVOICE",
  "TRANSPORT EXPORT",
  "TRANSPORT IMPORT",
];

function billTypeCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Customer Master v2 field groups for the "organization" resource. Account
// Info/Billing are Accounts-editable (Sales view-only on these financial
// fields); Branches/Addresses/Contacts mirror the Doer/Branch Manager edit
// rights already established on the "job" resource's non-financial groups.
const ORGANIZATION_FIELD_PERMISSIONS: Record<Role, Record<string, FieldAccessLevel>> = {
  ADMIN: { accountInfo: "EDIT", billing: "EDIT", branches: "EDIT", addresses: "EDIT", contacts: "EDIT" },
  BRANCH_MANAGER: { accountInfo: "VIEW", billing: "VIEW", branches: "EDIT", addresses: "EDIT", contacts: "EDIT" },
  DOER: { accountInfo: "NONE", billing: "NONE", branches: "EDIT", addresses: "EDIT", contacts: "EDIT" },
  SALES: { accountInfo: "VIEW", billing: "VIEW", branches: "VIEW", addresses: "VIEW", contacts: "VIEW" },
  ACCOUNTS: { accountInfo: "EDIT", billing: "EDIT", branches: "VIEW", addresses: "VIEW", contacts: "VIEW" },
  CUSTOMER: { accountInfo: "NONE", billing: "NONE", branches: "NONE", addresses: "NONE", contacts: "NONE" },
};

async function main() {
  console.log("Seeding branches...");
  const branches = await Promise.all(
    BRANCHES.map((name) =>
      prisma.branch.upsert({
        where: { code: name.toUpperCase().slice(0, 3) },
        update: {},
        create: { name, code: name.toUpperCase().slice(0, 3) },
      }),
    ),
  );

  console.log("Seeding test users...");
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const user of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        branchId: user.role === "CUSTOMER" ? null : branches[0].id,
      },
    });
  }

  console.log("Seeding field permissions...");
  for (const [role, groups] of Object.entries(FIELD_PERMISSIONS) as [Role, Record<string, FieldAccessLevel>][]) {
    for (const [fieldGroup, access] of Object.entries(groups)) {
      await prisma.fieldPermission.upsert({
        where: { role_resource_fieldGroup: { role, resource: "job", fieldGroup } },
        update: { access },
        create: { role, resource: "job", fieldGroup, access },
      });
    }
  }

  console.log("Seeding organization field permissions...");
  for (const [role, groups] of Object.entries(ORGANIZATION_FIELD_PERMISSIONS) as [
    Role,
    Record<string, FieldAccessLevel>,
  ][]) {
    for (const [fieldGroup, access] of Object.entries(groups)) {
      await prisma.fieldPermission.upsert({
        where: { role_resource_fieldGroup: { role, resource: "organization", fieldGroup } },
        update: { access },
        create: { role, resource: "organization", fieldGroup, access },
      });
    }
  }

  console.log("Seeding bill types...");
  for (const name of BILL_TYPE_NAMES) {
    const code = billTypeCode(name);
    await prisma.billType.upsert({
      where: { code },
      update: { name },
      create: { name, code },
    });
  }

  // Stage 5 — Import workflow templates (Ex-Works & FOB). Idempotent: the
  // template upserts on (shipmentType, incotermKey) and each step on
  // (templateId, stepKey), so a re-run refreshes labels/order/roles without
  // duplicating rows or disturbing any in-flight JobWorkflowProgress.
  console.log("Seeding workflow templates...");
  for (const tpl of IMPORT_WORKFLOW_TEMPLATES) {
    const template = await prisma.workflowTemplate.upsert({
      where: { shipmentType_incotermKey: { shipmentType: tpl.shipmentType, incotermKey: tpl.incotermKey } },
      update: { name: tpl.name },
      create: { name: tpl.name, shipmentType: tpl.shipmentType, incotermKey: tpl.incotermKey },
    });
    for (let i = 0; i < tpl.steps.length; i++) {
      const step = tpl.steps[i];
      const data = {
        label: step.label,
        sortOrder: i,
        ownerRole: step.ownerRole,
        approverRole: step.approverRole ?? null,
        isApprovalGate: Boolean(step.approverRole),
      };
      await prisma.workflowStep.upsert({
        where: { templateId_stepKey: { templateId: template.id, stepKey: step.stepKey } },
        update: data,
        create: { templateId: template.id, stepKey: step.stepKey, ...data },
      });
    }
  }

  console.log("Done. Test users (password: %s):", TEST_PASSWORD);
  TEST_USERS.forEach((u) => console.log(`  ${u.role.padEnd(15)} ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
