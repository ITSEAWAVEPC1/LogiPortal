import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Role, type FieldAccessLevel } from "../src/generated/prisma/client";

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
