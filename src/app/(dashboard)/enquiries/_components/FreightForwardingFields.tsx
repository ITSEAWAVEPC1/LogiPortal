"use client";

import { Button, Checkbox, Input, Select } from "@/components/ui";
import { CARGO_MODE_OPTIONS, DIMENSION_UNIT_OPTIONS, FINAL_DESTINATION_ADDRESS_INCOTERMS } from "@/lib/validation/enquiry";
import type { FieldConfigEntry } from "@/lib/enquiries/field-config-keys";

export interface FreightPackageState {
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "" | "MM" | "CM";
  weight: number | null;
  containerType: string;
}

export interface FreightDetailState {
  incoterm: string;
  portOfLoadingId: string;
  portOfDischargeId: string;
  finalDestinationAddress: string;
  cargoMode: "" | "LCL_AIR" | "FCL";
  packages: FreightPackageState[];
  isOdc: boolean;
  odcDimensions: string;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
}

const EMPTY_PACKAGE: FreightPackageState = {
  length: null,
  width: null,
  height: null,
  dimensionUnit: "",
  weight: null,
  containerType: "",
};

export const EMPTY_FREIGHT_DETAIL: FreightDetailState = {
  incoterm: "",
  portOfLoadingId: "",
  portOfDischargeId: "",
  finalDestinationAddress: "",
  cargoMode: "",
  packages: [],
  isOdc: false,
  odcDimensions: "",
  odcPackageCount: null,
  odcPerPackageWeight: null,
};

const INCOTERM_OPTIONS = ["EXW", "FOB", "CIF", "DDP", "DDU", "FCA", "CPT", "CIP", "DAP", "DPU"].map((v) => ({
  value: v,
  label: v,
}));

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

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

  const showDestinationAddress = FINAL_DESTINATION_ADDRESS_INCOTERMS.includes(
    value.incoterm as (typeof FINAL_DESTINATION_ADDRESS_INCOTERMS)[number],
  );

  const totalWeight = value.packages.reduce((sum, p) => sum + (p.weight || 0), 0);

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Freight Forwarding Details</h3>
      <div className="grid grid-cols-3 gap-3">
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
            label="Final Destination Address"
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
            <span className="text-sm font-medium text-text-primary">
              {value.cargoMode === "FCL" ? "Containers" : "Packages"}
            </span>
            {!disabled && (
              <Button size="sm" variant="ghost" onClick={addPackage}>
                {value.cargoMode === "FCL" ? "+ Add container" : "+ Add package"}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {value.packages.map((pkg, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border-subtle p-2">
                {value.cargoMode === "FCL" && (
                  <Input
                    label="Container Type"
                    value={pkg.containerType}
                    onChange={(e) => updatePackage(index, { containerType: e.target.value })}
                    disabled={disabled}
                    className="w-32"
                  />
                )}
                <Input
                  label="Length"
                  type="number"
                  value={pkg.length ?? ""}
                  onChange={(e) => updatePackage(index, { length: numOrNull(e.target.value) })}
                  disabled={disabled}
                  className="w-20"
                />
                <Input
                  label="Width"
                  type="number"
                  value={pkg.width ?? ""}
                  onChange={(e) => updatePackage(index, { width: numOrNull(e.target.value) })}
                  disabled={disabled}
                  className="w-20"
                />
                <Input
                  label="Height"
                  type="number"
                  value={pkg.height ?? ""}
                  onChange={(e) => updatePackage(index, { height: numOrNull(e.target.value) })}
                  disabled={disabled}
                  className="w-20"
                />
                <Select
                  label="Unit"
                  placeholder="Select..."
                  value={pkg.dimensionUnit}
                  onChange={(e) => updatePackage(index, { dimensionUnit: e.target.value as FreightPackageState["dimensionUnit"] })}
                  options={[...DIMENSION_UNIT_OPTIONS]}
                  disabled={disabled}
                  className="w-24"
                />
                <Input
                  label={value.cargoMode === "FCL" ? "Weight per container" : "Weight"}
                  type="number"
                  value={pkg.weight ?? ""}
                  onChange={(e) => updatePackage(index, { weight: numOrNull(e.target.value) })}
                  disabled={disabled}
                  className="w-32"
                />
                {!disabled && (
                  <Button size="sm" variant="ghost" onClick={() => removePackage(index)}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {value.packages.length === 0 && <p className="text-xs text-text-tertiary">No packages added.</p>}
          </div>
          {value.packages.length > 0 && (
            <p className="mt-2 text-xs text-text-tertiary">Total weight: {totalWeight}</p>
          )}
        </div>
      )}

      {value.cargoMode === "FCL" && (
        <>
          <div className="mt-3">
            <Checkbox
              label="Over-Dimensional Cargo (ODC)?"
              checked={value.isOdc}
              onChange={(e) => set("isOdc", e.target.checked)}
              disabled={disabled}
            />
          </div>
          {value.isOdc && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Input
                label="ODC Dimensions"
                value={value.odcDimensions}
                onChange={(e) => set("odcDimensions", e.target.value)}
                disabled={disabled}
              />
              <Input
                label="ODC No. of Packages"
                type="number"
                value={value.odcPackageCount ?? ""}
                onChange={(e) => set("odcPackageCount", numOrNull(e.target.value))}
                disabled={disabled}
              />
              <Input
                label="ODC Per Package Weight"
                type="number"
                value={value.odcPerPackageWeight ?? ""}
                onChange={(e) => set("odcPerPackageWeight", numOrNull(e.target.value))}
                disabled={disabled}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
