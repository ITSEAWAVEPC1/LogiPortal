"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getVisibleNavItems } from "@/lib/permissions/access-matrix";
import type { Role } from "@/lib/permissions/roles";

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const items = getVisibleNavItems(role);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border-subtle bg-surface">
      <div className="px-4 py-5">
        {/* brand PNGs are 1920x1080 with wide built-in whitespace; w-36 renders
            the mark at a sensible sidebar-header size (see login/page.tsx). */}
        <Image
          src="/brand/sw_black.png"
          alt="Seawave"
          width={480}
          height={270}
          priority
          className="h-auto w-36"
        />
      </div>
      {/* useSearchParams (for the sub-link active state) needs a Suspense
          boundary in the App Router. */}
      <Suspense fallback={<nav className="flex-1 px-2" />}>
        <SidebarNav items={items} />
      </Suspense>
    </aside>
  );
}

function SidebarNav({ items }: { items: ReturnType<typeof getVisibleNavItems> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="flex-1 space-y-1 px-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const linkClass = cn(
          "block rounded-md px-3 py-2 text-sm font-medium",
          active
            ? "bg-brand-teal/10 text-brand-teal"
            : "text-text-secondary hover:bg-background hover:text-text-primary",
        );

        if (!item.children) {
          return (
            <Link key={item.key} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          );
        }

        return (
          <div key={item.key}>
            <Link href={item.href} className={linkClass}>
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
