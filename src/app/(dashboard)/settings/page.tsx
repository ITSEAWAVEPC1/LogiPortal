import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Badge, Card } from "@/components/ui";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role, branchId } = session.user;

  if (role === "ADMIN") {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Settings</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/settings/branches">
            <Card className="transition-colors hover:border-brand-teal">
              <h2 className="text-sm font-semibold text-text-primary">Branches</h2>
              <p className="mt-1 text-sm text-text-secondary">Manage branch offices and their active status.</p>
            </Card>
          </Link>
          <Link href="/settings/users">
            <Card className="transition-colors hover:border-brand-teal">
              <h2 className="text-sm font-semibold text-text-primary">Users</h2>
              <p className="mt-1 text-sm text-text-secondary">Manage staff accounts, roles, and branch assignment.</p>
            </Card>
          </Link>
          <Link href="/settings/bill-types">
            <Card className="transition-colors hover:border-brand-teal">
              <h2 className="text-sm font-semibold text-text-primary">Bill Types</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Manage the Bill Type master used by the Customer Billing tab.
              </p>
            </Card>
          </Link>
        </div>
      </div>
    );
  }

  if (role === "BRANCH_MANAGER") {
    const branch = branchId
      ? await prisma.branch.findUnique({
          where: { id: branchId },
          include: { _count: { select: { users: true } } },
        })
      : null;

    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Settings</h1>
        <Card className="max-w-md">
          <h2 className="text-sm font-semibold text-text-primary">Your branch</h2>
          {branch ? (
            <div className="mt-3 flex flex-col gap-2 text-sm text-text-secondary">
              <p>
                <span className="text-text-tertiary">Name:</span> {branch.name}
              </p>
              <p>
                <span className="text-text-tertiary">Code:</span> {branch.code}
              </p>
              <p>
                <span className="text-text-tertiary">Users:</span> {branch._count.users}
              </p>
              <Badge variant={branch.isActive ? "success" : "neutral"}>
                {branch.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">No branch assigned to your account.</p>
          )}
          <p className="mt-4 text-xs text-text-tertiary">
            Branch settings are view-only for Branch Managers. Contact an Admin for changes.
          </p>
        </Card>
      </div>
    );
  }

  redirect("/dashboard");
}
