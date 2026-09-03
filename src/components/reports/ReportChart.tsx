"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/shadcn/chart";
import type { ReportChart as ReportChartType } from "@/lib/reports/types";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function ReportChart({ chart }: { chart: ReportChartType }) {
  const config: ChartConfig = Object.fromEntries(
    chart.series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      {chart.kind === "line" ? (
        <LineChart data={chart.data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact.format(Number(v))} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {chart.series.length > 1 ? <Legend /> : null}
          {chart.series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      ) : (
        <BarChart accessibilityLayer data={chart.data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact.format(Number(v))} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {chart.series.length > 1 ? <Legend /> : null}
          {chart.series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}
