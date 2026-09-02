import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Class-name combiner. Stage 10a upgraded this from a hand-rolled clsx-style
// join to `twMerge(clsx(...))` so the shadcn primitives in
// src/components/shadcn/ resolve conflicting Tailwind utilities predictably
// ("last wins"). clsx accepts the same string / number / object / nested-array
// inputs the previous implementation did, so every existing caller in
// src/components/ui/ keeps working unchanged.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
