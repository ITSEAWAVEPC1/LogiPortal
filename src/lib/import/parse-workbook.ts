import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export interface ParsedWorkbook {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseWorkbook(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  let worksheet: ExcelJS.Worksheet | undefined;
  if (isCsv) {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    worksheet = workbook.worksheets[0];
  }

  if (!worksheet) throw new Error("No worksheet found in the uploaded file.");
  return sheetToRows(worksheet);
}

function sheetToRows(worksheet: ExcelJS.Worksheet): ParsedWorkbook {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = cellToString(row.getCell(idx + 1).value);
      record[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && value.text) return String(value.text);
    if ("result" in value && value.result !== undefined) return String(value.result);
    return "";
  }
  return String(value).trim();
}
