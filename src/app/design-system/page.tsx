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
import { Button as SButton } from "@/components/shadcn/button";
import { Badge as SBadge } from "@/components/shadcn/badge";
import {
  Card as SCard,
  CardContent as SCardContent,
  CardHeader as SCardHeader,
  CardTitle as SCardTitle,
} from "@/components/shadcn/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import {
  Table as STable,
  TableBody as STableBody,
  TableCell as STableCell,
  TableHead as STableHead,
  TableHeader as STableHeader,
  TableRow as STableRow,
} from "@/components/shadcn/table";

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

      <section className="mb-10">
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

      {/* Stage 10a — shadcn/ui primitives (src/components/shadcn/*), brand-mapped
          via src/styles/shadcn-tokens.css. Used only on the new /dashboard and
          /reports surfaces; the primitives above remain the app-wide set. */}
      <div className="mt-16 border-t border-border-subtle pt-8">
        <h1 className="mb-8 text-2xl font-semibold text-text-primary">shadcn/ui primitives (Stage 10a)</h1>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <SButton>Default</SButton>
            <SButton variant="secondary">Secondary</SButton>
            <SButton variant="outline">Outline</SButton>
            <SButton variant="ghost">Ghost</SButton>
            <SButton variant="destructive">Destructive</SButton>
            <SButton disabled>Disabled</SButton>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Badges</h2>
          <div className="flex flex-wrap gap-3">
            <SBadge>Default</SBadge>
            <SBadge variant="secondary">Secondary</SBadge>
            <SBadge variant="outline">Outline</SBadge>
            <SBadge variant="destructive">Destructive</SBadge>
          </div>
        </section>

        <section className="mb-10 grid gap-6 md:grid-cols-2">
          <SCard>
            <SCardHeader>
              <SCardTitle>Card</SCardTitle>
            </SCardHeader>
            <SCardContent className="text-sm text-muted-foreground">
              Header / Title / Content sub-components, on <code>bg-card</code> with a token border.
            </SCardContent>
          </SCard>

          <SCard>
            <SCardHeader>
              <SCardTitle>Tabs</SCardTitle>
            </SCardHeader>
            <SCardContent>
              <Tabs defaultValue="one">
                <TabsList>
                  <TabsTrigger value="one">Overview</TabsTrigger>
                  <TabsTrigger value="two">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="one" className="pt-3 text-sm text-muted-foreground">
                  Overview panel.
                </TabsContent>
                <TabsContent value="two" className="pt-3 text-sm text-muted-foreground">
                  Activity panel.
                </TabsContent>
              </Tabs>
            </SCardContent>
          </SCard>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Table</h2>
          <SCard>
            <SCardContent>
              <STable>
                <STableHeader>
                  <STableRow>
                    <STableHead>Job ID</STableHead>
                    <STableHead>Customer</STableHead>
                    <STableHead>Status</STableHead>
                  </STableRow>
                </STableHeader>
                <STableBody>
                  {demoRows.map((row) => (
                    <STableRow key={row.id}>
                      <STableCell className="font-medium">{row.id}</STableCell>
                      <STableCell>{row.customer}</STableCell>
                      <STableCell>
                        <SBadge variant="outline">{row.status}</SBadge>
                      </STableCell>
                    </STableRow>
                  ))}
                </STableBody>
              </STable>
            </SCardContent>
          </SCard>
        </section>
      </div>
    </div>
  );
}
