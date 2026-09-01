import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getJobFieldAccess, redactJobForRole } from "@/lib/permissions/job-fields";
import { JobForm, type JobDetail } from "../_components/JobForm";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  if (!can(role, "jobs", "view")) redirect("/jobs");

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      quotationEnquiry: { select: { id: true, quotationId: true } },
      shipperDetail: true,
      consigneeDetail: true,
      notifyPartyDetail: true,
      containers: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!job) notFound();

  const fieldAccess = await getJobFieldAccess(role);
  // Strip field groups this role has NONE access to before the data crosses to
  // the client — mirrors the API GET route's redaction.
  const redacted = redactJobForRole(job, fieldAccess) as unknown as JobDetail;

  return (
    <JobForm
      job={redacted}
      role={role}
      canEdit={can(role, "jobs", "edit")}
      canApprove={can(role, "jobs", "approve")}
      fieldAccess={fieldAccess}
    />
  );
}
