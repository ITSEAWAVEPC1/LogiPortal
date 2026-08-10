"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id ?? props.name;
    return (
      <label htmlFor={checkboxId} className="flex items-center gap-2 text-sm text-text-primary">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={cn("h-4 w-4 rounded border-border-subtle text-brand-teal focus:ring-brand-teal", className)}
          {...props}
        />
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
