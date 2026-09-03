"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { cn } from "@/lib/utils/cn";

interface Row {
  id: string;
  type: string;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationList() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (f: "all" | "unread", after: string | null) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ filter: f });
        if (after) qs.set("cursor", after);
        const res = await fetch(`/api/notifications?${qs}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setItems((prev) => (after ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor ?? null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Deferred a tick — React 19 set-state-in-effect rule (see WorkflowPanel).
    queueMicrotask(() => void load(filter, null));
  }, [filter, load]);

  async function open(n: Row) {
    if (!n.readAt) {
      await fetch(`/api/notifications/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.linkPath) router.push(n.linkPath);
  }

  async function markAll() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-border-subtle p-0.5 text-sm">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-3 py-1 capitalize",
                filter === f ? "bg-brand-teal text-white" : "text-text-secondary hover:bg-background",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={markAll} className="text-sm text-brand-teal hover:underline">
          Mark all read
        </button>
      </div>

      {items.length === 0 && !loading ? (
        <Card className="p-6 text-center text-sm text-text-secondary">Nothing here.</Card>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-card">
          {items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={cn(
                  "block w-full px-4 py-3 text-left hover:bg-background",
                  !n.readAt && "bg-brand-teal/5",
                )}
              >
                <p className="flex items-start justify-between gap-3 text-sm font-medium text-text-primary">
                  <span>{n.title}</span>
                  <span className="shrink-0 text-xs font-normal text-text-tertiary">{fmt(n.createdAt)}</span>
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">{n.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => load(filter, cursor)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
