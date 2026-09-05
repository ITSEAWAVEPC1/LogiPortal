"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({ className, label, id, ...props }, ref) => {
  const radioId = id ?? `${props.name}-${props.value}`;
  return (
    <label htmlFor={radioId} className="flex items-center gap-2 text-sm text-text-primary">
      <input
        ref={ref}
        type="radio"
        id={radioId}
        className={cn("h-4 w-4 border-border-subtle text-brand-teal focus:ring-brand-teal", className)}
        {...props}
      />
      {label}
    </label>
  );
});
Radio.displayName = "Radio";
