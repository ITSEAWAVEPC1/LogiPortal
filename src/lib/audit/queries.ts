// Stage 10d — read helpers for the global /audit viewer. Job activity is
// branch-scoped (reportScope: ADMIN all, BRANCH_MANAGER own branch); portal
// access + login history are ADMIN-only and the pages enforce that.

import { prisma } from "@/lib/db/prisma";
import { resolveReportBranchIds } from "@/lib/reports/common";
import { formatJobRef } from "@/lib/validation/job";
import type { Scope } from "@/lib/permissions/scope";
import type { Prisma } from "@/generated/prisma/client";
import {
  jobAuditActionLabel,
  jobAuditNote,
  PORTAL_ACCESS_OUTCOME_LABEL,
} from "./labels";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface AuditPage<T> {
  rows: T[];
  nextCursor: string | null;
}

function clampLimit(n?: number): number {
  return Math.min(Math.max(1, n ?? DEFAULT_LIMIT), MAX_LIMIT);
}

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
}

// --- job activity -------------------------------------------------------

export interface JobAuditFilters {
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  branchId?: string;
  cursor?: string;
  limit?: number;
}

export interface JobAuditRow {
  id: string;
  createdAt: Date;
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole: string;
  jobRef: string;
  branchName: string;
  stepKey: string | null;
  note: string | null;
}

export async function getJobAuditPage(
  scope: Scope,
  f: JobAuditFilters,
): Promise<AuditPage<JobAuditRow>> {
  const branchIds = resolveReportBranchIds(scope, f.branchId);
  const range = dateRange(f.from, f.to);
  const where: Prisma.JobAuditLogWhereInput = {
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(branchIds ? { job: { branchId: { in: branchIds } } } : {}),
  };
  const take = clampLimit(f.limit);
  const rows = await prisma.jobAuditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      action: true,
      stepKey: true,
      detail: true,
      actor: { select: { name: true, role: true } },
      job: {
        select: {
          referenceNo: true,
          sequenceNumber: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
      },
    },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    rows: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      actionLabel: jobAuditActionLabel(r.action),
      actorName: r.actor?.name ?? "—",
      actorRole: r.actor?.role ?? "—",
      jobRef: formatJobRef(r.job),
      branchName: r.job.branch.name,
      stepKey: r.stepKey,
      note: jobAuditNote(r.detail),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

// --- portal access (ADMIN only) --------------------------------------

export interface PortalAccessRow {
  id: string;
  createdAt: Date;
  userEmail: string;
  outcome: string;
  outcomeLabel: string;
  path: string;
  resource: string;
}

export async function getPortalAccessPage(f: {
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}): Promise<AuditPage<PortalAccessRow>> {
  const range = dateRange(f.from, f.to);
  const take = clampLimit(f.limit);
  const rows = await prisma.portalAccessLog.findMany({
    where: range ? { createdAt: range } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      outcome: true,
      path: true,
      resourceType: true,
      resourceId: true,
      user: { select: { email: true } },
    },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    rows: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      userEmail: r.user?.email ?? "—",
      outcome: r.outcome,
      outcomeLabel: PORTAL_ACCESS_OUTCOME_LABEL[r.outcome] ?? r.outcome,
      path: r.path,
      resource: r.resourceType ? `${r.resourceType} ${r.resourceId ?? ""}`.trim() : "—",
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

// --- login history (ADMIN only) ------------------------------------

export interface LoginRow {
  id: string;
  createdAt: Date;
  userEmail: string;
  userName: string;
  role: string;
  ipAddress: string;
  userAgent: string;
}

export async function getLoginAuditPage(f: {
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}): Promise<AuditPage<LoginRow>> {
  const range = dateRange(f.from, f.to);
  const take = clampLimit(f.limit);
  const rows = await prisma.session.findMany({
    where: range ? { createdAt: range } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      ipAddress: true,
      userAgent: true,
      user: { select: { email: true, name: true, role: true } },
    },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    rows: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      userEmail: r.user?.email ?? "—",
      userName: r.user?.name ?? "—",
      role: r.user?.role ?? "—",
      ipAddress: r.ipAddress ?? "—",
      userAgent: r.userAgent ?? "—",
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/** Users for the actor filter (small list — all users). */
export async function getAuditActors(): Promise<Array<{ id: string; name: string; role: string }>> {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}
