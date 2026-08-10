import { Card } from "@/components/ui";

interface StagePlaceholderProps {
  title: string;
  stage: number;
}

export function StagePlaceholder({ title, stage }: StagePlaceholderProps) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">{title}</h1>
      <Card>
        <p className="text-sm text-text-secondary">
          This screen is scaffolded by Stage 0&apos;s layout shell. Its real functionality is built in{" "}
          <span className="font-medium text-text-primary">Stage {stage}</span> of the staged development plan.
        </p>
      </Card>
    </div>
  );
}
