"use client";

import { Button, Input, Select } from "@/components/ui";
import { CARGO_MODE_OPTIONS, DIMENSION_UNIT_OPTIONS, FINAL_DESTINATION_ADDRESS_INCOTERMS } from "@/lib/validation/enquiry";
import type { FieldConfigEntry } from "@/lib/enquiries/field-config-keys";

export interface FreightPackageState {
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "" | "MM" | "CM" | "IN" | "FT" | "M";
  weight: number | null;
  containerType: string;
  numberOfContainers: number | null;
}

export interface FreightDetailState {
  incoterm: string;
  portOfLoadingId: string;
  portOfDischargeId: string;
  finalDestinationAddress: string;
  cargoMode: "" | "LCL_AIR" | "FCL";
  packages: FreightPackageState[];
}

const EMPTY_PACKAGE: FreightPackageState = {
  length: null,
  width: null,
  height: null,
  dimensionUnit: "",
  weight: null,
  containerType: "",
  numberOfContainers: null,
};

export const EMPTY_FREIGHT_DETAIL: FreightDetailState = {
  incoterm: "",
  portOfLoadingId: "",
  portOfDischargeId: "",
  finalDestinationAddress: "",
  cargoMode: "",
  packages: [],
};

const INCOTERM_OPTIONS = ["EXW", "FOB", "CIF", "DDP", "DDU", "FCA", "CPT", "CIP", "DAP", "DPU"].map((v) => ({
  value: v,
  label: v,
}));

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

// Per-row column set — FCL is container-centric (Stage 14a: type + how many +
// weight per container, no L/W/H); LCL & Air keeps dimensions.
type PackageColumn = { key: keyof FreightPackageState; label: string; width: string };

const FCL_COLUMNS: PackageColumn[] = [
  { key: "containerType", label: "Container Type", width: "w-40" },
  { key: "numberOfContainers", label: "No. of Containers", width: "w-32" },
  { key: "weight", label: "Weight per Container", width: "w-40" },
];

const LCL_COLUMNS: PackageColumn[] = [
  { key: "length", label: "Length", width: "w-24" },
  { key: "width", label: "Width", width: "w-24" },
  { key: "height", label: "Height", width: "w-24" },
  { key: "dimensionUnit", label: "Unit", width: "w-24" },
  { key: "weight", label: "Weight", width: "w-28" },
];

export interface PortOption {
  id: string;
  name: string;
  code: string | null;
}

interface FreightForwardingFieldsProps {
  value: FreightDetailState;
  onChange: (value: FreightDetailState) => void;
  disabled?: boolean;
  ports: PortOption[];
  // Admin-configured visibility per field key (Stage 12c) — missing entries
  // default to visible, matching the DB-side default.
  fieldConfig?: Record<string, FieldConfigEntry>;
}

export function FreightForwardingFields({ value, onChange, disabled, ports, fieldConfig }: FreightForwardingFieldsProps) {
  function set<K extends keyof FreightDetailState>(key: K, v: FreightDetailState[K]) {
    onChange({ ...value, [key]: v });
  }

  function visible(fieldKey: string): boolean {
    return fieldConfig?.[fieldKey]?.isVisible ?? true;
  }

  function setCargoMode(mode: FreightDetailState["cargoMode"]) {
    onChange({ ...value, cargoMode: mode, packages: value.packages.length > 0 ? value.packages : mode ? [{ ...EMPTY_PACKAGE }] : [] });
  }

  function updatePackage(index: number, patch: Partial<FreightPackageState>) {
    onChange({ ...value, packages: value.packages.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }

  function addPackage() {
    onChange({ ...value, packages: [...value.packages, { ...EMPTY_PACKAGE }] });
  }

  function removePackage(index: number) {
    onChange({ ...value, packages: value.packages.filter((_, i) => i !== index) });
  }

  const portOptions = ports.map((p) => ({ value: p.id, label: p.code ? `${p.name} (${p.code})` : p.name }));

  const isFcl = value.cargoMode === "FCL";
  const columns = isFcl ? FCL_COLUMNS : LCL_COLUMNS;

  const showDestinationAddress = FINAL_DESTINATION_ADDRESS_INCOTERMS.includes(
    value.incoterm as (typeof FINAL_DESTINATION_ADDRESS_INCOTERMS)[number],
  );

  const totalWeight = value.packages.reduce((sum, p) => sum + (p.weight || 0), 0);

  function renderCell(pkg: FreightPackageState, index: number, col: PackageColumn) {
    if (col.key === "dimensionUnit") {
      return (
        <Select
          aria-label={col.label}
          placeholder="Unit"
          value={pkg.dimensionUnit}
          onChange={(e) => updatePackage(index, { dimensionUnit: e.target.value as FreightPackageState["dimensionUnit"] })}
          options={[...DIMENSION_UNIT_OPTIONS]}
          disabled={disabled}
          className="w-full"
        />
      );
    }
    if (col.key === "containerType") {
      return (
        <Input
          aria-label={col.label}
          value={pkg.containerType}
          onChange={(e) => updatePackage(index, { containerType: e.target.value })}
          disabled={disabled}
          className="w-full"
        />
      );
    }
    // numeric columns: length / width / height / weight / numberOfContainers
    const raw = pkg[col.key];
    return (
      <Input
        aria-label={col.label}
        type="number"
        value={raw === null ? "" : String(raw)}
        onChange={(e) => updatePackage(index, { [col.key]: numOrNull(e.target.value) } as Partial<FreightPackageState>)}
        disabled={disabled}
        className="w-full"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Freight Forwarding Details</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {visible("incoterm") && (
          <Select
            label="Incoterm"
            placeholder="Select..."
            value={value.incoterm}
            onChange={(e) => set("incoterm", e.target.value)}
            options={INCOTERM_OPTIONS}
            disabled={disabled}
          />
        )}
        {visible("portOfLoadingId") && (
          <Select
            label="Port of Loading"
            placeholder="Select..."
            value={value.portOfLoadingId}
            onChange={(e) => set("portOfLoadingId", e.target.value)}
            options={portOptions}
            disabled={disabled}
          />
        )}
        {visible("portOfDischargeId") && (
          <Select
            label="Port of Discharge"
            placeholder="Select..."
            value={value.portOfDischargeId}
            onChange={(e) => set("portOfDischargeId", e.target.value)}
            options={portOptions}
            disabled={disabled}
          />
        )}
      </div>

      {showDestinationAddress && (
        <div className="mt-3">
          <Input
            label={value.incoterm === "EXW" ? "Pickup Address" : "Final Destination Address"}
            value={value.finalDestinationAddress}
            onChange={(e) => set("finalDestinationAddress", e.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      {visible("cargoMode") && (
        <div className="mt-3">
          <Select
            label="Cargo Mode"
            placeholder="Select..."
            value={value.cargoMode}
            onChange={(e) => setCargoMode(e.target.value as FreightDetailState["cargoMode"])}
            options={[...CARGO_MODE_OPTIONS]}
            disabled={disabled}
          />
        </div>
      )}

      {visible("packages") && value.cargoMode && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">{isFcl ? "Containers" : "Packages"}</span>
            {!disabled && (
              <Button size="sm" variant="ghost" onClick={addPackage}>
                {isFcl ? "+ Add container" : "+ Add package"}
              </Button>
            )}
          </div>

          {/* Column headings — shown once (Stage 14a), not repeated per row. */}
          {value.packages.length > 0 && (
            <div className="mb-1 hidden flex-wrap gap-2 lg:flex">
              {columns.map((c) => (
                <span key={c.key} className={`${c.width} text-xs font-medium text-text-tertiary`}>
                  {c.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {value.packages.map((pkg, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border-subtle p-2">
                {columns.map((col) => (
                  <div key={col.key} className={`flex flex-col gap-1 ${col.width}`}>
                    <span className="text-xs font-medium text-text-tertiary lg:hidden">{col.label}</span>
                    {renderCell(pkg, index, col)}
                  </div>
                ))}
                {!disabled && (
                  <Button size="sm" variant="ghost" onClick={() => removePackage(index)}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {value.packages.length === 0 && <p className="text-xs text-text-tertiary">No packages added.</p>}
          </div>
          {value.packages.length > 0 && <p className="mt-2 text-xs text-text-tertiary">Total weight: {totalWeight}</p>}
        </div>
      )}
    </div>
  );
}
