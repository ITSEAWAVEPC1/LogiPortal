"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { useAppShellDrawer } from "@/components/layout/AppShell";

// The portal has no desktop Topbar (no search/branch-select — dashboard-only
// concepts), so unlike the dashboard shell it needs a small header of its
// own purely to host the mobile hamburger trigger.
export function PortalMobileHeader() {
  const { toggle } = useAppShellDrawer();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border-subtle bg-surface px-4 lg:hidden">
      <button onClick={toggle} aria-label="Open menu" className="text-text-secondary hover:text-text-primary">
        <Menu className="size-5" />
      </button>
      <Image src="/brand/sw_black.png" alt="Seawave" width={480} height={270} className="h-6 w-auto" />
    </header>
  );
}
