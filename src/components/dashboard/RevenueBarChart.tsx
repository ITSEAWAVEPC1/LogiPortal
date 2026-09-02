"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/shadcn/chart";

const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function RevenueBarChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => compact.format(Number(v))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `₹ ${Number(value).toLocaleString("en-IN")}`}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
