"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/shadcn/chart";

const config = {
  onTime: { label: "On time", color: "var(--chart-1)" },
  delayed: { label: "Delayed", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function OnTimeDonut({
  onTime,
  delayed,
  noTarget,
}: {
  onTime: number;
  delayed: number;
  noTarget: number;
}) {
  const total = onTime + delayed;
  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-secondary">
        No delivered jobs with a target date yet.
      </p>
    );
  }

  const data = [
    { label: "On time", value: onTime, fill: "var(--color-onTime)" },
    { label: "Delayed", value: delayed, fill: "var(--color-delayed)" },
  ];

  return (
    <div>
      <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <p className="mt-2 text-center text-sm text-text-secondary">
        {((onTime / total) * 100).toFixed(0)}% on time ({onTime}/{total})
        {noTarget > 0 ? (
          <span className="text-text-tertiary"> · {noTarget} without a target date</span>
        ) : null}
      </p>
    </div>
  );
}
