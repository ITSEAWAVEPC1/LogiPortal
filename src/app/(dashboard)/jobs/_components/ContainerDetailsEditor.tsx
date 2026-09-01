"use client";

import { Button, Input } from "@/components/ui";

export interface ContainerRow {
  containerNumber: string;
  sealNumber: string;
  containerType: string;
  count: number | null;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  packageCount: number | null;
}

export const EMPTY_CONTAINER_ROW: ContainerRow = {
  containerNumber: "",
  sealNumber: "",
  containerType: "",
  count: 1,
  grossWeight: null,
  tareWeight: null,
  netWeight: null,
  packageCount: null,
};

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

interface ContainerDetailsEditorProps {
  items: ContainerRow[];
  onChange: (items: ContainerRow[]) => void;
  readOnly: boolean;
}

export function ContainerDetailsEditor({ items, onChange, readOnly }: ContainerDetailsEditorProps) {
  function update(index: number, patch: Partial<ContainerRow>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Containers</h3>
        {!readOnly && (
          <Button size="sm" variant="ghost" onClick={() => onChange([...items, { ...EMPTY_CONTAINER_ROW }])}>
            + Add container
          </Button>
        )}
      </div>
      {items.length === 0 && <p className="text-xs text-text-tertiary">No containers added.</p>}
      {items.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2 rounded-md border border-border-subtle p-2 sm:grid-cols-4">
          <Input
            label="Container No."
            value={row.containerNumber}
            onChange={(e) => update(index, { containerNumber: e.target.value })}
            disabled={readOnly}
          />
          <Input
            label="Seal No."
            value={row.sealNumber}
            onChange={(e) => update(index, { sealNumber: e.target.value })}
            disabled={readOnly}
          />
          <Input
            label="Type"
            value={row.containerType}
            onChange={(e) => update(index, { containerType: e.target.value })}
            disabled={readOnly}
          />
          <Input
            label="Count"
            type="number"
            value={row.count ?? ""}
            onChange={(e) => update(index, { count: numOrNull(e.target.value) })}
            disabled={readOnly}
          />
          <Input
            label="Gross Wt"
            type="number"
            value={row.grossWeight ?? ""}
            onChange={(e) => update(index, { grossWeight: numOrNull(e.target.value) })}
            disabled={readOnly}
          />
          <Input
            label="Tare Wt"
            type="number"
            value={row.tareWeight ?? ""}
            onChange={(e) => update(index, { tareWeight: numOrNull(e.target.value) })}
            disabled={readOnly}
          />
          <Input
            label="Net Wt"
            type="number"
            value={row.netWeight ?? ""}
            onChange={(e) => update(index, { netWeight: numOrNull(e.target.value) })}
            disabled={readOnly}
          />
          <Input
            label="Packages"
            type="number"
            value={row.packageCount ?? ""}
            onChange={(e) => update(index, { packageCount: numOrNull(e.target.value) })}
            disabled={readOnly}
          />
          {!readOnly && (
            <div className="col-span-2 sm:col-span-4">
              <Button size="sm" variant="ghost" onClick={() => remove(index)}>
                Remove
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
