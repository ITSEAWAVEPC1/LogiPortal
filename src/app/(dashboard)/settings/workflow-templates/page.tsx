import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { WorkflowTemplateManager } from "./_components/WorkflowTemplateManager";

export default async function WorkflowTemplatesSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "workflowTemplates", "edit")) redirect("/settings");

  const templates = await prisma.workflowTemplate.findMany({
    orderBy: [{ shipmentType: "asc" }, { incotermKey: "asc" }],
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      _count: { select: { jobProgress: true } },
    },
  });

  return (
    <WorkflowTemplateManager
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        shipmentType: t.shipmentType,
        incotermKey: t.incotermKey,
        isActive: t.isActive,
        jobCount: t._count.jobProgress,
        steps: t.steps.map((s) => ({
          id: s.id,
          stepKey: s.stepKey,
          label: s.label,
          sortOrder: s.sortOrder,
          ownerRole: s.ownerRole,
          approverRole: s.approverRole,
          isApprovalGate: s.isApprovalGate,
          isActive: s.isActive,
        })),
      }))}
    />
  );
}
