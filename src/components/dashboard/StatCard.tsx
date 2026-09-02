import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** teal for positive/primary counts, plum for "needs attention" counts */
  accent?: "teal" | "plum" | "neutral";
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  teal: "text-brand-teal",
  plum: "text-brand-plum",
  neutral: "text-text-secondary",
};

export function StatCard({ label, value, hint, icon: Icon, accent = "neutral" }: StatCardProps) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
          {Icon ? <Icon className={cn("size-4", ACCENT[accent])} aria-hidden /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold text-text-primary tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
