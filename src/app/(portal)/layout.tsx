import Image from "next/image";
import { Card } from "@/components/ui";
import { PortalNav } from "@/components/portal/PortalNav";
import { PortalSignOut } from "@/components/portal/PortalSignOut";
import { getPortalContext } from "@/lib/portal/guard";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Redirects an unauthenticated visitor to /login, a non-CUSTOMER to
  // /dashboard, and 404s the group when CUSTOMER_PORTAL_ENABLED=false.
  const ctx = await getPortalContext();

  return (
    <div className="flex h-screen">
      <aside className="flex h-full w-60 flex-col border-r border-border-subtle bg-surface">
        <div className="px-4 py-5">
          <Image src="/brand/sw_black.png" alt="Seawave" width={480} height={270} priority className="h-auto w-36" />
        </div>
        <PortalNav />
        <div className="border-t border-border-subtle px-4 py-3">
          <p className="truncate text-sm font-medium text-text-primary">{ctx.userName}</p>
          <p className="mb-2 text-xs text-text-tertiary">Customer portal</p>
          <PortalSignOut />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {ctx.orgId ? children : <PortalNotLinked />}
      </main>
    </div>
  );
}

function PortalNotLinked() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Welcome</h1>
      <Card>
        <p className="text-sm text-text-secondary">
          Your login isn&apos;t linked to an organization yet, so there are no shipments or documents to show.
          Please contact your Seawave representative to have your account connected.
        </p>
      </Card>
    </div>
  );
}
