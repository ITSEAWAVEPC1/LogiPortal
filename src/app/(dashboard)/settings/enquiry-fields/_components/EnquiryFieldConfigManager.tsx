"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Checkbox } from "@/components/ui";
import { ENQUIRY_FIELD_KEYS, type FieldConfigMap } from "@/lib/enquiries/field-config-keys";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  FREIGHT_FORWARDING: "Freight Forwarding",
  CUSTOMS_CLEARANCE: "Customs Clearance",
  TRANSPORTATION: "Transportation",
};

interface EnquiryFieldConfigManagerProps {
  initialConfig: FieldConfigMap;
}

export function EnquiryFieldConfigManager({ initialConfig }: EnquiryFieldConfigManagerProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function toggle(serviceType: string, fieldKey: string, patch: { isVisible?: boolean; isRequired?: boolean }) {
    const current = config[serviceType]?.[fieldKey] ?? { isVisible: true, isRequired: true };
    const next = { ...current, ...patch };
    const rowKey = `${serviceType}:${fieldKey}`;
    setSavingKey(rowKey);
    setConfig((prev) => ({ ...prev, [serviceType]: { ...prev[serviceType], [fieldKey]: next } }));

    await fetch("/api/enquiry-field-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceType, fieldKey, ...next }),
    });

    setSavingKey(null);
    router.refresh();
  }

  const byServiceType = ENQUIRY_FIELD_KEYS.reduce<Record<string, typeof ENQUIRY_FIELD_KEYS[number][]>>((acc, key) => {
    (acc[key.serviceType] ??= []).push(key);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Enquiry Field Configuration</h1>
      <p className="mb-4 text-sm text-text-secondary">
        Control which fields appear on the Enquiry form and whether they&apos;re required to submit, per service type. A
        field hidden here is also never required — leaving it visible but marking it not required just makes it
        optional.
      </p>

      <div className="flex flex-col gap-4">
        {Object.entries(byServiceType).map(([serviceType, keys]) => (
          <Card key={serviceType}>
            <h2 className="mb-3 text-sm font-semibold text-text-primary">
              {SERVICE_TYPE_LABELS[serviceType] ?? serviceType}
            </h2>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border-subtle pb-2 text-xs font-medium text-text-tertiary">
                <span>Field</span>
                <span>Visible</span>
                <span>Required</span>
              </div>
              {keys.map(({ fieldKey, label }) => {
                const entry = config[serviceType]?.[fieldKey] ?? { isVisible: true, isRequired: true };
                const rowKey = `${serviceType}:${fieldKey}`;
                return (
                  <div key={fieldKey} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-1">
                    <span className="text-sm text-text-primary">{label}</span>
                    <Checkbox
                      checked={entry.isVisible}
                      disabled={savingKey === rowKey}
                      onChange={(e) => toggle(serviceType, fieldKey, { isVisible: e.target.checked })}
                    />
                    <Checkbox
                      checked={entry.isRequired}
                      disabled={savingKey === rowKey || !entry.isVisible}
                      onChange={(e) => toggle(serviceType, fieldKey, { isRequired: e.target.checked })}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
