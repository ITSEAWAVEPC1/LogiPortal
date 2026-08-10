"use client";

import { Checkbox, Input, Select } from "@/components/ui";
import { CARGO_MODE_OPTIONS } from "@/lib/validation/enquiry";

export interface FreightDetailState {
  incoterm: string;
  portOfLoading: string;
  portOfDischarge: string;
  cargoMode: "" | "LCL_AIR" | "FCL";
  packageCount: number | null;
  dimensions: string;
  weight: number | null;
  fclWeight: number | null;
  containerType: string;
  containerCount: number | null;
  isOdc: boolean;
  odcDimensions: string;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
}

export const EMPTY_FREIGHT_DETAIL: FreightDetailState = {
  incoterm: "",
  portOfLoading: "",
  portOfDischarge: "",
  cargoMode: "",
  packageCount: null,
  dimensions: "",
  weight: null,
  fclWeight: null,
  containerType: "",
  containerCount: null,
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

interface FreightForwardingFieldsProps {
  value: FreightDetailState;
  onChange: (value: FreightDetailState) => void;
  disabled?: boolean;
}

export function FreightForwardingFields({ value, onChange, disabled }: FreightForwardingFieldsProps) {
  function set<K extends keyof FreightDetailState>(key: K, v: FreightDetailState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Freight Forwarding Details</h3>
      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Incoterm"
          placeholder="Select..."
          value={value.incoterm}
          onChange={(e) => set("incoterm", e.target.value)}
          options={INCOTERM_OPTIONS}
          disabled={disabled}
        />
        <Input
          label="Port of Loading"
          value={value.portOfLoading}
          onChange={(e) => set("portOfLoading", e.target.value)}
          disabled={disabled}
        />
        <Input
          label="Port of Discharge"
          value={value.portOfDischarge}
          onChange={(e) => set("portOfDischarge", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="mt-3">
        <Select
          label="Cargo Mode"
          placeholder="Select..."
          value={value.cargoMode}
          onChange={(e) => set("cargoMode", e.target.value as FreightDetailState["cargoMode"])}
          options={[...CARGO_MODE_OPTIONS]}
          disabled={disabled}
        />
      </div>

      {value.cargoMode === "LCL_AIR" && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Input
            label="No. of Packages"
            type="number"
            value={value.packageCount ?? ""}
            onChange={(e) => set("packageCount", numOrNull(e.target.value))}
            disabled={disabled}
          />
          <Input
            label="Dimensions"
            value={value.dimensions}
            onChange={(e) => set("dimensions", e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Weight"
            type="number"
            value={value.weight ?? ""}
            onChange={(e) => set("weight", numOrNull(e.target.value))}
            disabled={disabled}
          />
        </div>
      )}

      {value.cargoMode === "FCL" && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Input
              label="Weight"
              type="number"
              value={value.fclWeight ?? ""}
              onChange={(e) => set("fclWeight", numOrNull(e.target.value))}
              disabled={disabled}
            />
            <Input
              label="Container Type"
              value={value.containerType}
              onChange={(e) => set("containerType", e.target.value)}
              disabled={disabled}
            />
            <Input
              label="No. of Containers"
              type="number"
              value={value.containerCount ?? ""}
              onChange={(e) => set("containerCount", numOrNull(e.target.value))}
              disabled={disabled}
            />
          </div>
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
