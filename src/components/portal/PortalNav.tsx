"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { label: "Dashboard", href: "/portal" },
  { label: "Jobs", href: "/portal/jobs" },
  { label: "Quotations", href: "/portal/quotations" },
  { label: "Documents", href: "/portal/documents" },
  { label: "Profile", href: "/portal/profile" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-2">
      {ITEMS.map((item) => {
        const active =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-brand-teal/10 text-brand-teal"
                : "text-text-secondary hover:bg-background hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
