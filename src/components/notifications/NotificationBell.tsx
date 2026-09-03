"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils/cn";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function NotificationBell({ viewAllHref = "/notifications" }: { viewAllHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=1", { cache: "no-store" });
      if (res.ok) setUnread((await res.json()).unreadCount ?? 0);
    } catch {
      /* ignore — badge is best-effort */
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so this isn't a direct setState-during-effect-body call
    // (React 19 lint rule — same pattern as WorkflowPanel).
    queueMicrotask(() => void refreshCount());
  }, [refreshCount, pathname]);

  async function loadList() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?filter=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadList();
  }

  async function openItem(n: NotificationRow) {
    setOpen(false);
    if (!n.readAt) {
      fetch(`/api/notifications/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      }).then(refreshCount);
    }
    if (n.linkPath) router.push(n.linkPath);
  }

  async function markAll() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label="Notifications"
        className="relative rounded-md border border-border-subtle p-2 text-text-secondary hover:bg-background focus:outline-none focus:ring-2 focus:ring-brand-teal"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-plum px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
          <span className="text-sm font-medium text-text-primary">Notifications</span>
          {unread > 0 ? (
            <button onClick={markAll} className="text-xs text-brand-teal hover:underline">
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={cn(
                      "block w-full px-3 py-2.5 text-left hover:bg-background",
                      !n.readAt && "bg-brand-teal/5",
                    )}
                  >
                    <p className="flex items-start justify-between gap-2 text-sm font-medium text-text-primary">
                      <span className="line-clamp-1">{n.title}</span>
                      <span className="shrink-0 text-xs font-normal text-text-tertiary">
                        {relTime(n.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {viewAllHref ? (
          <div className="border-t border-border-subtle px-3 py-2 text-center">
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="text-xs text-brand-teal hover:underline"
            >
              View all
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
