"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/types";

interface Pref {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  mutedTypes: string[];
}

export function NotificationPreferenceForm() {
  const [pref, setPref] = useState<Pref | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/notifications/preferences", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPref(d.preference))
      .catch(() => setStatus("error"));
  }, []);

  async function save(next: Pref) {
    setPref(next);
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (!pref) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  const toggleMuted = (type: string) => {
    const muted = pref.mutedTypes.includes(type)
      ? pref.mutedTypes.filter((t) => t !== type)
      : [...pref.mutedTypes, type];
    save({ ...pref, mutedTypes: muted });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={pref.inAppEnabled}
              onChange={(e) => save({ ...pref, inAppEnabled: e.target.checked })}
              className="size-4 accent-[var(--brand-teal)]"
            />
            In-app notifications (the bell)
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={pref.emailEnabled}
              onChange={(e) => save({ ...pref, emailEnabled: e.target.checked })}
              className="size-4 accent-[var(--brand-teal)]"
            />
            Email notifications
          </label>
          <p className="text-xs text-text-tertiary">
            Email is only sent when the platform has email delivery configured; in-app notifications
            always work.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mute specific events</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pref.mutedTypes.includes(t)}
                onChange={() => toggleMuted(t)}
                className="size-4 accent-[var(--brand-plum)]"
              />
              <span className="text-text-secondary">{NOTIFICATION_TYPE_LABELS[t]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-text-tertiary" aria-live="polite">
        {saving ? "Saving…" : status === "saved" ? "Preferences saved." : status === "error" ? "Could not save." : ""}
      </p>
    </div>
  );
}
