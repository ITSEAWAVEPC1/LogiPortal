import { Card } from "@/components/ui";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalProfile } from "@/lib/portal/queries";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="text-sm text-text-primary">{value || "—"}</dd>
    </div>
  );
}

export default async function PortalProfilePage() {
  const ctx = await getPortalContext();
  const org = await getPortalProfile(ctx.orgId);

  if (!org) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Organization profile</h1>
        <Card>
          <p className="text-sm text-text-secondary">No organization profile is available.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Organization profile</h1>
      <p className="mb-6 text-sm text-text-secondary">
        This is how your organization is recorded with Seawave. Contact your representative to update any of these details.
      </p>

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Company</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={org.name} />
            <Field label="Also known as" value={org.alias} />
            <Field label="City" value={org.city} />
            <Field label="State" value={org.state} />
            <Field label="Default currency" value={org.defaultCurrency} />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Primary contact</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={org.contactPersonName} />
            <Field label="Phone" value={org.contactPersonPhone} />
            <Field label="Email" value={org.contactPersonEmail} />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Statutory</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="GST number" value={org.kycDetail?.gstNumber} />
            <Field label="PAN number" value={org.kycDetail?.panNumber} />
            <Field label="TAN number" value={org.kycDetail?.tanNumber} />
          </dl>
        </Card>
      </div>
    </div>
  );
}
