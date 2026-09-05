"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, Menu } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions/roles";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAppShellDrawer } from "@/components/layout/AppShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

interface Branch {
  id: string;
  name: string;
}

interface TopbarProps {
  userName: string;
  role: Role;
  branches: Branch[];
}

export function Topbar({ userName, role, branches }: TopbarProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const { toggle } = useAppShellDrawer();

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4 lg:px-6">
      <button onClick={toggle} aria-label="Open menu" className="text-text-secondary hover:text-text-primary lg:hidden">
        <Menu className="size-5" />
      </button>
      <input
        type="search"
        placeholder="Search..."
        className="hidden w-64 rounded-md border border-border-subtle bg-background px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-teal lg:block"
      />
      <div className="flex min-w-0 items-center gap-4">
        {role === "ADMIN" && branches.length > 0 && (
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            aria-label="Branch"
            className="rounded-md border border-border-subtle bg-background px-2 py-1.5 text-sm text-text-primary"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-md border border-border-subtle px-3 py-1.5 text-left text-sm hover:bg-background focus:outline-none focus:ring-2 focus:ring-brand-teal">
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-medium text-text-primary">{userName}</span>
              <span className="block truncate text-xs text-text-secondary">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium text-text-primary">{userName}</span>
              <span className="block text-xs text-text-secondary">{ROLE_LABELS[role]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/notifications">Notification preferences</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
