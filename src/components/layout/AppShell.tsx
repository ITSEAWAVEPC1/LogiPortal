"use client";

import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Stage 13a — shared responsive shell for both (dashboard) and (portal) route
// groups. Below `lg` the sidebar becomes an off-canvas drawer (hamburger
// trigger lives in each caller's own header, via useAppShellDrawer); at `lg`+
// it's the original always-visible w-60 sidebar. See
// docs/stage-checklists/stage-13a.md.

export interface AppShellNavItem {
  key: string;
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

interface DrawerState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerState | null>(null);

export function useAppShellDrawer(): DrawerState {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useAppShellDrawer must be used within an AppShell");
  return ctx;
}

interface AppShellProps {
  navItems: AppShellNavItem[];
  /** e.g. the portal's user/sign-out block. Omitted for the dashboard shell. */
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

export function AppShell({ navItems, sidebarFooter, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <DrawerContext.Provider value={{ open, toggle, close }}>
      <div className="flex h-screen">
        <div
          onClick={close}
          aria-hidden="true"
          className={cn("fixed inset-0 z-40 bg-black/40 lg:hidden", open ? "block" : "hidden")}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-60 flex-col border-r border-border-subtle bg-surface transition-transform duration-200",
            "lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-4 py-5">
            {/* brand PNGs are 1920x1080 with wide built-in whitespace; w-36
                renders the mark at a sensible sidebar-header size (see
                login/page.tsx). */}
            <Image src="/brand/sw_black.png" alt="Seawave" width={480} height={270} priority className="h-auto w-36" />
            <button
              onClick={close}
              aria-label="Close menu"
              className="text-text-secondary hover:text-text-primary lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>
          {/* useSearchParams (for the sub-link active state) needs a Suspense
              boundary in the App Router. */}
          <Suspense fallback={<nav className="flex-1 px-2" />}>
            <AppShellNav items={navItems} onNavigate={close} />
          </Suspense>
          {sidebarFooter}
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </DrawerContext.Provider>
  );
}

function AppShellNav({ items, onNavigate }: { items: AppShellNavItem[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Longest-prefix match across top-level hrefs, so a nav root that is also
  // an ancestor path of a sibling (e.g. the portal's "/portal" Dashboard vs
  // "/portal/jobs") isn't marked active at the same time as the more
  // specific sibling. A no-op for the dashboard shell today (no NAV_ITEMS
  // href is a prefix of another there) but keeps this shared component
  // correct for any nav tree.
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2">
      {items.map((item) => {
        const active = item.href === activeHref;
        const linkClass = cn(
          "block rounded-md px-3 py-2 text-sm font-medium",
          active
            ? "bg-brand-teal/10 text-brand-teal"
            : "text-text-secondary hover:bg-background hover:text-text-primary",
        );

        if (!item.children) {
          return (
            <Link key={item.key} href={item.href} className={linkClass} onClick={onNavigate}>
              {item.label}
            </Link>
          );
        }

        return (
          <div key={item.key}>
            <Link href={item.href} className={linkClass} onClick={onNavigate}>
              {item.label}
            </Link>
            <ul className="mt-1 space-y-1 pl-3">
              {item.children.map((child) => {
                const [childPath, childQuery = ""] = child.href.split("?");
                const wanted = new URLSearchParams(childQuery).get("shipmentType");
                const childActive =
                  pathname === childPath && searchParams.get("shipmentType") === wanted;
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm",
                        childActive
                          ? "bg-brand-teal/10 font-medium text-brand-teal"
                          : "text-text-secondary hover:bg-background hover:text-text-primary",
                      )}
                    >
                      {child.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
