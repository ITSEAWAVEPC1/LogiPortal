// Stage 10d — audit rows -> (headers, string[][]) for rowsToCsv.
import type { JobAuditRow, LoginRow, PortalAccessRow } from "./queries";

const iso = (d: Date) => d.toISOString();

export function jobAuditToCsv(rows: JobAuditRow[]): { headers: string[]; body: string[][] } {
  return {
    headers: ["Timestamp", "Actor", "Role", "Action", "Job", "Branch", "Step", "Note"],
    body: rows.map((r) => [
      iso(r.createdAt),
      r.actorName,
      r.actorRole,
      r.action,
      r.jobRef,
      r.branchName,
      r.stepKey ?? "",
      r.note ?? "",
    ]),
  };
}

export function portalAccessToCsv(rows: PortalAccessRow[]): { headers: string[]; body: string[][] } {
  return {
    headers: ["Timestamp", "User", "Outcome", "Path", "Resource"],
    body: rows.map((r) => [iso(r.createdAt), r.userEmail, r.outcome, r.path, r.resource]),
  };
}

export function loginAuditToCsv(rows: LoginRow[]): { headers: string[]; body: string[][] } {
  return {
    headers: ["Timestamp", "User", "Name", "Role", "IP", "User agent"],
    body: rows.map((r) => [iso(r.createdAt), r.userEmail, r.userName, r.role, r.ipAddress, r.userAgent]),
  };
}
