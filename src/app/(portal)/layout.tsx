import { Card } from "@/components/ui";
import { AppShell } from "@/components/layout/AppShell";
import { PortalMobileHeader } from "@/components/portal/PortalMobileHeader";
import { PortalSignOut } from "@/components/portal/PortalSignOut";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getPortalContext } from "@/lib/portal/guard";
import { PORTAL_NAV_ITEMS } from "@/lib/portal/nav-items";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Redirects an unauthenticated visitor to /login, a non-CUSTOMER to
  // /dashboard, and 404s the group when CUSTOMER_PORTAL_ENABLED=false.
  const ctx = await getPortalContext();

  return (
    <AppShell
      navItems={PORTAL_NAV_ITEMS}
      sidebarFooter={
        <div className="border-t border-border-subtle px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{ctx.userName}</p>
              <p className="text-xs text-text-tertiary">Customer portal</p>
            </div>
            <NotificationBell viewAllHref="" />
          </div>
          <PortalSignOut />
        </div>
      }
    >
      <PortalMobileHeader />
      <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
        {ctx.orgId ? children : <PortalNotLinked />}
      </main>
    </AppShell>
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
