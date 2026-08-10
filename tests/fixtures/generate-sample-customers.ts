// Regenerable fixture for verifying Stage 1's bulk import wizard acceptance
// criteria (~200 rows: mostly valid, some intentionally broken). Run with:
//   npx tsx tests/fixtures/generate-sample-customers.ts
// Output goes to tests/fixtures/output/ (gitignored) — this script is the
// committed asset, not its .xlsx output.
import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";

const CITIES = ["Mumbai", "Delhi", "Chennai", "Kolkata", "Bengaluru", "Surat", "Pune", "Ahmedabad", "Hyderabad", "Jaipur"];
const STATES = ["Maharashtra", "Delhi", "Tamil Nadu", "West Bengal", "Karnataka", "Gujarat", "Telangana", "Rajasthan"];
const COMPANY_SUFFIXES = [
  "Traders",
  "Exports",
  "Imports",
  "Logistics",
  "Freight Pvt Ltd",
  "Enterprises",
  "Industries",
  "Shipping Co",
  "Overseas",
  "International",
];
const FIRST_NAMES = ["Raj", "Priya", "Amit", "Sunita", "Vikram", "Anita", "Suresh", "Kavita", "Manoj", "Deepa"];
const LAST_NAMES = ["Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Nair", "Rao", "Mehta", "Singh", "Joshi"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

function randomLetters(n: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

function generateValidGst(index: number): string {
  const stateCode = String(10 + (index % 27)).padStart(2, "0");
  return `${stateCode}${randomLetters(5)}${randomDigits(4)}${randomLetters(1)}${index % 2 === 0 ? "1" : "9"}Z${randomLetters(1)}`;
}

interface Row {
  name: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  city: string;
  state: string;
  gstNumber: string;
  panNumber: string;
  tanNumber: string;
}

function buildValidRow(index: number): Row {
  const first = randomFrom(FIRST_NAMES);
  const last = randomFrom(LAST_NAMES);
  return {
    name: `${last} ${randomFrom(COMPANY_SUFFIXES)} ${index}`,
    contactPersonName: `${first} ${last}`,
    contactPersonPhone: `9${randomDigits(9)}`,
    contactPersonEmail: `${first}.${last}${index}@example.com`.toLowerCase(),
    city: randomFrom(CITIES),
    state: randomFrom(STATES),
    gstNumber: generateValidGst(index),
    panNumber: `${randomLetters(5)}${randomDigits(4)}${randomLetters(1)}`,
    tanNumber: `${randomLetters(4)}${randomDigits(5)}${randomLetters(1)}`,
  };
}

async function main() {
  const VALID_COUNT = 170;
  const MISSING_NAME_COUNT = 15;
  const BAD_GST_COUNT = 10;
  const DUP_GST_COUNT = 5;

  const rows: Row[] = [];
  for (let i = 0; i < VALID_COUNT; i++) rows.push(buildValidRow(i));

  for (let i = 0; i < MISSING_NAME_COUNT; i++) {
    const row = buildValidRow(1000 + i);
    row.name = "";
    rows.push(row);
  }

  for (let i = 0; i < BAD_GST_COUNT; i++) {
    const row = buildValidRow(2000 + i);
    row.gstNumber = `BADGST${i}`; // fails GST_REGEX
    rows.push(row);
  }

  // Reuse GST numbers from the first 5 valid rows -> flagged as in-file duplicates.
  for (let i = 0; i < DUP_GST_COUNT; i++) {
    const row = buildValidRow(3000 + i);
    row.gstNumber = rows[i].gstNumber;
    rows.push(row);
  }

  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customers");
  sheet.columns = [
    { header: "Customer Name", key: "name" },
    { header: "Contact Person", key: "contactPersonName" },
    { header: "Phone", key: "contactPersonPhone" },
    { header: "Email", key: "contactPersonEmail" },
    { header: "City", key: "city" },
    { header: "State", key: "state" },
    { header: "GST Number", key: "gstNumber" },
    { header: "PAN Number", key: "panNumber" },
    { header: "TAN Number", key: "tanNumber" },
  ];
  sheet.addRows(rows);

  const outDir = path.resolve(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-customers.xlsx");
  await workbook.xlsx.writeFile(outPath);

  console.log(
    `Generated ${rows.length} rows (${VALID_COUNT} valid, ${MISSING_NAME_COUNT} missing name, ${BAD_GST_COUNT} malformed GST, ${DUP_GST_COUNT} duplicate GST) -> ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
