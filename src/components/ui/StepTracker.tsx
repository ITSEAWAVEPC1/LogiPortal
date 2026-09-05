import { cn } from "@/lib/utils/cn";

export interface Step {
  id: string;
  label: string;
  status: "completed" | "active" | "pending";
}

interface StepTrackerProps {
  steps: Step[];
  orientation?: "vertical" | "horizontal";
}

// Teal = completed, Plum = active/in-progress, Gray = pending — Section 2.1's rule.
function dotClasses(status: Step["status"]) {
  switch (status) {
    case "completed":
      return "bg-brand-teal text-white";
    case "active":
      return "bg-brand-plum text-white";
    default:
      return "bg-border-subtle text-text-secondary";
  }
}

// The horizontal orientation's fixed-width steps compress and collide on a
// narrow viewport (labels wrap, dots overlap) rather than scrolling — below
// `lg` it falls back to this same vertical layout instead.
function VerticalSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", dotClasses(step.status))} />
            {i < steps.length - 1 && (
              <span
                className={cn("w-0.5 flex-1", step.status === "completed" ? "bg-brand-teal" : "bg-border-subtle")}
                style={{ minHeight: "1.5rem" }}
              />
            )}
          </div>
          <div className="pb-6">
            <p className="text-sm font-medium text-text-primary">{step.label}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StepTracker({ steps, orientation = "vertical" }: StepTrackerProps) {
  if (orientation === "horizontal") {
    return (
      <>
        <ol className="hidden w-full items-start lg:flex">
          {steps.map((step, i) => (
            <li key={step.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span className={cn("h-3 w-3 rounded-full", dotClasses(step.status))} />
                <span className="max-w-[6rem] text-center text-xs text-text-secondary">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "mx-2 h-0.5 flex-1 self-start mt-1.5",
                    step.status === "completed" ? "bg-brand-teal" : "bg-border-subtle",
                  )}
                />
              )}
            </li>
          ))}
        </ol>
        <div className="lg:hidden">
          <VerticalSteps steps={steps} />
        </div>
      </>
    );
  }

  return <VerticalSteps steps={steps} />;
}
