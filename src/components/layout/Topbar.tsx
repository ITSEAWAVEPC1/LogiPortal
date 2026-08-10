"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ROLE_LABELS, type Role } from "@/lib/permissions/roles";

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
        {branches.length > 0 && (
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
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
        >
          Notifications
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-text-primary">{userName}</p>
            <p className="text-xs text-text-secondary">{ROLE_LABELS[role]}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
