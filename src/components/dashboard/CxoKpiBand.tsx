"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import type { CxoKpis } from "@/lib/dashboard/kpis";

const PERIODS = [
  { key: "YTD", label: "YTD" },
  { key: "MTD", label: "MTD" },
  { key: "WTD", label: "WTD" },
  { key: "CUSTOM", label: "Custom" },
] as const;

export function CxoKpiBand({ initial }: { initial: CxoKpis }) {
  const [kpis, setKpis] = useState(initial);
  const [period, setPeriod] = useState<string>(initial.periodKey);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load(p: string, f?: string, t?: string) {
    setError(null);
    const qs = new URLSearchParams({ period: p });
    if (p === "CUSTOM") {
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
    }
    start(async () => {
      const res = await fetch(`/api/dashboard/kpis?${qs}`);
      if (!res.ok) {
        setError("Failed to load KPIs");
        return;
      }
      setKpis(await res.json());
    });
  }

  function selectPeriod(p: string) {
    setPeriod(p);
    if (p !== "CUSTOM") load(p);
  }

  const pdfQs = new URLSearchParams({ period });
  if (period === "CUSTOM") {
    if (from) pdfQs.set("from", from);
    if (to) pdfQs.set("to", to);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border-subtle p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPeriod(p.key)}
                  className={`rounded px-3 py-1 text-sm ${
                    period === p.key ? "bg-brand-teal text-white" : "text-text-secondary hover:bg-background"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === "CUSTOM" ? (
              <>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-border-subtle bg-background px-2 py-1 text-sm text-text-primary"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-border-subtle bg-background px-2 py-1 text-sm text-text-primary"
                />
                <Button size="sm" onClick={() => load("CUSTOM", from, to)} disabled={pending}>
                  Apply
                </Button>
              </>
            ) : null}
          </div>
          <a
            href={`/api/dashboard/report.pdf?${pdfQs}`}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
          >
            Download report
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Jobs created" value={kpis.jobsCreated.toLocaleString("en-IN")} pending={pending} />
          <Kpi
            label="On-time delivery"
            value={kpis.onTimeRate === null ? "—" : `${(kpis.onTimeRate * 100).toFixed(1)}%`}
            sub={`${kpis.jobsDelivered.toLocaleString("en-IN")} delivered`}
            pending={pending}
          />
          <Kpi
            label="Revenue (quoted)"
            value={`₹ ${kpis.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            pending={pending}
          />
        </div>
        <p className="text-xs text-text-tertiary">
          {kpis.periodLabel}
          {error ? ` · ${error}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  sub,
  pending,
}: {
  label: string;
  value: string;
  sub?: string;
  pending: boolean;
}) {
  return (
    <div className={`rounded-lg border border-border-subtle p-4 ${pending ? "opacity-60" : ""}`}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-text-secondary">{sub}</p> : null}
    </div>
  );
}
