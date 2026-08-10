"use client";

import { Checkbox, Input, Select } from "@/components/ui";
import { CARGO_MODE_OPTIONS, DELIVERY_TYPE_OPTIONS } from "@/lib/validation/enquiry";

export interface TransportDetailState {
  pickup: string;
  destination: string;
  cargoMode: "" | "LCL_AIR" | "FCL";
  packageCount: number | null;
  dimensions: string;
  weight: number | null;
  fclWeight: number | null;
  containerType: string;
  deliveryType: "" | "LOADED" | "DESTUFF";
  isOdc: boolean;
  odcDimensions: string;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
}

export const EMPTY_TRANSPORT_DETAIL: TransportDetailState = {
  pickup: "",
  destination: "",
  cargoMode: "",
  packageCount: null,
  dimensions: "",
  weight: null,
  fclWeight: null,
  containerType: "",
  deliveryType: "",
  isOdc: false,
  odcDimensions: "",
  odcPackageCount: null,
  odcPerPackageWeight: null,
};

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

interface TransportationFieldsProps {
  value: TransportDetailState;
  onChange: (value: TransportDetailState) => void;
  disabled?: boolean;
}

// Note: unlike Freight Forwarding's FCL block, Transportation's FCL block has
// no "No. of Containers" field — it has Delivery Type (Loaded/Destuff) instead.
export function TransportationFields({ value, onChange, disabled }: TransportationFieldsProps) {
  function set<K extends keyof TransportDetailState>(key: K, v: TransportDetailState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Transportation Details</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Pickup" value={value.pickup} onChange={(e) => set("pickup", e.target.value)} disabled={disabled} />
        <Input
          label="Destination"
          value={value.destination}
          onChange={(e) => set("destination", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="mt-3">
        <Select
          label="Cargo Mode"
          placeholder="Select..."
          value={value.cargoMode}
          onChange={(e) => set("cargoMode", e.target.value as TransportDetailState["cargoMode"])}
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
            <Select
              label="Delivery Type"
              placeholder="Select..."
              value={value.deliveryType}
              onChange={(e) => set("deliveryType", e.target.value as TransportDetailState["deliveryType"])}
              options={[...DELIVERY_TYPE_OPTIONS]}
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
