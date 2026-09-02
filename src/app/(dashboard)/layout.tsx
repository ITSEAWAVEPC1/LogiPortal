import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Stage 9 — CUSTOMER users live entirely in the /portal route group; bounce
  // them off every internal route before any query runs (defense-in-depth
  // alongside proxy's authorized() redirect and each page's can() check).
  if (session.user.role === "CUSTOMER") redirect("/portal");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex h-screen">
      <Sidebar role={session.user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          userName={session.user.name ?? session.user.email ?? "User"}
          role={session.user.role}
          branches={branches}
        />
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
