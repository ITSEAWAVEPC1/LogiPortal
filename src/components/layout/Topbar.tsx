"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions/roles";
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

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-6">
      <input
        type="search"
        placeholder="Search..."
        className="w-64 rounded-md border border-border-subtle bg-background px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-teal"
      />
      <div className="flex items-center gap-4">
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
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-md border border-border-subtle p-2 text-text-secondary hover:bg-background"
        >
          <Bell className="size-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-1.5 text-left text-sm hover:bg-background focus:outline-none focus:ring-2 focus:ring-brand-teal">
            <span className="leading-tight">
              <span className="block font-medium text-text-primary">{userName}</span>
              <span className="block text-xs text-text-secondary">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronDown className="size-4 text-text-tertiary" />
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
