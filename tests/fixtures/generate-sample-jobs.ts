// Regenerable fixture for verifying Stage 4's historical-Job import acceptance
// criteria (~1000 rows: mostly valid, some intentionally broken). Run with:
//   npx tsx tests/fixtures/generate-sample-jobs.ts
// Output goes to tests/fixtures/output/ (gitignored) — this script is the
// committed asset, not its .xlsx output.
//
// Rows reference customers named "ZZZ Job Customer <n>" (n = 0..19) and the
// standard seeded branches, so the verifier must create those customers first
// (the branches come from prisma/seed.ts).
import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";

const BRANCHES = ["Mumbai", "Kolkata", "Surat", "Jogbani", "Raxaul", "Sounali", "Chennai"];
const CUSTOMER_COUNT = 20;
const PORTS = ["INNSA", "INMUN", "INMAA", "SGSIN", "AEJEA", "NLRTM", "DEHAM", "CNSHA", "USNYC", "GBFXT"];
const LINES = ["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "ONE", "Evergreen", "COSCO"];
const VESSELS = ["MV Horizon", "MV Meridian", "MV Trident", "MV Odyssey", "MV Pioneer", "MV Aurora"];
const COMMODITIES = ["Textiles", "Machinery", "Auto Parts", "Chemicals", "Electronics", "Rice", "Furniture"];
const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "20RF", "40RF"];
const STATUSES = ["Workflow in Progress", "Completed", "Delivered", "Ongoing", "Closed"];
const INCOTERMS_IMPORT = ["EXW", "FOB"];
const INCOTERMS_EXPORT = ["CIF", "DDP", "DDU"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function digits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

interface Row {
  customerName: string;
  branch: string;
  shipmentType: string;
  workflowStatus: string;
  serviceTypes: string;
  incoterm: string;
  agentDetails: string;
  placeOfReceipt: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  shippingLineName: string;
  cfsName: string;
  vesselName: string;
  voyageNumber: string;
  freeDaysAtPod: string;
  containerType: string;
  containerCount: string;
  totalGrossWeight: string;
  totalNetWeight: string;
  totalPackages: string;
  volumeCbm: string;
  commodity: string;
  hsCode: string;
  shipperName: string;
  shipperAddress: string;
  consigneeName: string;
  consigneeAddress: string;
  notifyName: string;
}

function buildValidRow(i: number): Row {
  const isImport = i % 2 === 0;
  return {
    customerName: `ZZZ Job Customer ${i % CUSTOMER_COUNT}`,
    branch: pick(BRANCHES, i),
    shipmentType: isImport ? "Import" : "Export",
    workflowStatus: rand(STATUSES),
    serviceTypes: rand(["FF", "FF, CC", "FF, CC, TPT", "CC"]),
    incoterm: isImport ? rand(INCOTERMS_IMPORT) : rand(INCOTERMS_EXPORT),
    agentDetails: `Agent ${digits(3)}`,
    placeOfReceipt: rand(PORTS),
    portOfLoading: rand(PORTS),
    portOfDischarge: rand(PORTS),
    placeOfDelivery: rand(PORTS),
    shippingLineName: rand(LINES),
    cfsName: `CFS ${rand(["Alpha", "Bravo", "Delta"])}`,
    vesselName: rand(VESSELS),
    voyageNumber: `V${digits(4)}`,
    freeDaysAtPod: String(3 + (i % 12)),
    containerType: rand(CONTAINER_TYPES),
    containerCount: String(1 + (i % 5)),
    totalGrossWeight: String(1000 + i * 7),
    totalNetWeight: String(800 + i * 6),
    totalPackages: String(10 + (i % 90)),
    volumeCbm: String((5 + (i % 60)).toFixed(2)),
    commodity: rand(COMMODITIES),
    hsCode: digits(8),
    shipperName: `Shipper ${i % CUSTOMER_COUNT} Pvt Ltd`,
    shipperAddress: `${digits(3)} Trade Street`,
    consigneeName: `Consignee ${i % CUSTOMER_COUNT} Inc`,
    consigneeAddress: `${digits(3)} Harbor Road`,
    notifyName: i % 3 === 0 ? `Notify ${i % CUSTOMER_COUNT}` : "",
  };
}

async function main() {
  const VALID_COUNT = 1000;
  const UNKNOWN_CUSTOMER = 12;
  const BAD_SHIPMENT_TYPE = 8;
  const BAD_STATUS = 8;
  const MISSING_BRANCH = 6;

  const rows: Row[] = [];
  for (let i = 0; i < VALID_COUNT; i++) rows.push(buildValidRow(i));

  for (let i = 0; i < UNKNOWN_CUSTOMER; i++) {
    const r = buildValidRow(10000 + i);
    r.customerName = `No Such Customer ${i}`;
    rows.push(r);
  }
  for (let i = 0; i < BAD_SHIPMENT_TYPE; i++) {
    const r = buildValidRow(20000 + i);
    r.shipmentType = "Sideways";
    rows.push(r);
  }
  for (let i = 0; i < BAD_STATUS; i++) {
    const r = buildValidRow(30000 + i);
    r.workflowStatus = "Schrodinger";
    rows.push(r);
  }
  for (let i = 0; i < MISSING_BRANCH; i++) {
    const r = buildValidRow(40000 + i);
    r.branch = "";
    rows.push(r);
  }

  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Jobs");
  sheet.columns = [
    { header: "Customer Name", key: "customerName" },
    { header: "Branch", key: "branch" },
    { header: "Shipment Type", key: "shipmentType" },
    { header: "Workflow Status", key: "workflowStatus" },
    { header: "Type of Service", key: "serviceTypes" },
    { header: "Incoterm", key: "incoterm" },
    { header: "Agent Details", key: "agentDetails" },
    { header: "Place of Receipt", key: "placeOfReceipt" },
    { header: "Port of Loading", key: "portOfLoading" },
    { header: "Port of Discharge", key: "portOfDischarge" },
    { header: "Place of Delivery", key: "placeOfDelivery" },
    { header: "Shipping Line", key: "shippingLineName" },
    { header: "CFS Name", key: "cfsName" },
    { header: "Vessel Name", key: "vesselName" },
    { header: "Voyage No.", key: "voyageNumber" },
    { header: "Free Days at POD", key: "freeDaysAtPod" },
    { header: "Container Type", key: "containerType" },
    { header: "No. of Containers", key: "containerCount" },
    { header: "Total Gross Weight", key: "totalGrossWeight" },
    { header: "Total Net Weight", key: "totalNetWeight" },
    { header: "No. of Packages", key: "totalPackages" },
    { header: "Volume (CBM)", key: "volumeCbm" },
    { header: "Commodity", key: "commodity" },
    { header: "HS Code", key: "hsCode" },
    { header: "Shipper Name", key: "shipperName" },
    { header: "Shipper Address", key: "shipperAddress" },
    { header: "Consignee Name", key: "consigneeName" },
    { header: "Consignee Address", key: "consigneeAddress" },
    { header: "Notify Party Name", key: "notifyName" },
  ];
  sheet.addRows(rows);

  const outDir = path.resolve(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-jobs.xlsx");
  await workbook.xlsx.writeFile(outPath);

  console.log(
    `Generated ${rows.length} rows (${VALID_COUNT} valid, ${UNKNOWN_CUSTOMER} unknown customer, ${BAD_SHIPMENT_TYPE} bad shipment type, ${BAD_STATUS} bad status, ${MISSING_BRANCH} missing branch) -> ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
