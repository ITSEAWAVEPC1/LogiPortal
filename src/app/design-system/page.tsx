import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Input,
  Select,
  StepTracker,
  Textarea,
} from "@/components/ui";
import type { Step } from "@/components/ui/StepTracker";

const demoSteps: Step[] = [
  { id: "1", label: "ETD from POL", status: "completed" },
  { id: "2", label: "SO Details", status: "completed" },
  { id: "3", label: "Container Pickup", status: "active" },
  { id: "4", label: "Handover at Port", status: "pending" },
  { id: "5", label: "Vessel Sail Date", status: "pending" },
];

const demoRows = [
  { id: "JOB-1001", customer: "Acme Traders", status: "In Transit" },
  { id: "JOB-1002", customer: "Nile Exports", status: "Delivered" },
];

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-8 text-2xl font-semibold text-text-primary">Seawave Design System</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Delivered</Badge>
          <Badge variant="active">In Progress</Badge>
          <Badge variant="pending">Pending</Badge>
          <Badge variant="warning">Delayed</Badge>
          <Badge variant="danger">Customs Hold</Badge>
        </div>
      </section>

      <section className="mb-10 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Form inputs</h2>
          <div className="flex flex-col gap-4">
            <Input label="Customer name" placeholder="Acme Traders" />
            <Select
              label="Shipment type"
              placeholder="Select..."
              options={[
                { value: "import", label: "Import" },
                { value: "export", label: "Export" },
              ]}
            />
            <Textarea label="RFQ reason" placeholder="Details..." rows={3} />
            <Checkbox label="Customer approved via call" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Step tracker — vertical
          </h2>
          <StepTracker steps={demoSteps} orientation="vertical" />
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Step tracker — horizontal
        </h2>
        <Card>
          <StepTracker steps={demoSteps} orientation="horizontal" />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Data table</h2>
        <DataTable
          columns={[
            { key: "id", header: "Job ID" },
            { key: "customer", header: "Customer" },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <Badge variant={row.status === "Delivered" ? "success" : "active"}>{row.status}</Badge>
              ),
            },
          ]}
          data={demoRows}
          getRowKey={(row) => row.id}
        />
      </section>
    </div>
  );
}
