"use client";

import { Input, Select } from "@/components/ui";
import { CARGO_MODE_OPTIONS, DELIVERY_TYPE_OPTIONS, DIMENSION_UNIT_OPTIONS } from "@/lib/validation/enquiry";
import type { FieldConfigEntry } from "@/lib/enquiries/field-config-keys";

export interface TransportDetailState {
  pickup: string;
  destination: string;
  cargoMode: "" | "LCL_AIR" | "FCL";
  packageCount: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "" | "MM" | "CM" | "IN" | "FT" | "M";
  weight: number | null;
  fclWeight: number | null;
  containerType: string;
  deliveryType: "" | "LOADED" | "DESTUFF";
}

export const EMPTY_TRANSPORT_DETAIL: TransportDetailState = {
  pickup: "",
  destination: "",
  cargoMode: "",
  packageCount: null,
  length: null,
  width: null,
  height: null,
  dimensionUnit: "",
  weight: null,
  fclWeight: null,
  containerType: "",
  deliveryType: "",
};

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

interface TransportationFieldsProps {
  value: TransportDetailState;
  onChange: (value: TransportDetailState) => void;
  disabled?: boolean;
  // Admin-configured visibility per field key (Stage 12c) — missing entries
  // default to visible, matching the DB-side default.
  fieldConfig?: Record<string, FieldConfigEntry>;
}

// Note: unlike Freight Forwarding's FCL block, Transportation's FCL block has
// no "No. of Containers" field — it has Delivery Type (Loaded/Destuff) instead.
export function TransportationFields({ value, onChange, disabled, fieldConfig }: TransportationFieldsProps) {
  function set<K extends keyof TransportDetailState>(key: K, v: TransportDetailState[K]) {
    onChange({ ...value, [key]: v });
  }

  function visible(fieldKey: string): boolean {
    return fieldConfig?.[fieldKey]?.isVisible ?? true;
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Transportation Details</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible("pickup") && (
          <Input label="Pickup" value={value.pickup} onChange={(e) => set("pickup", e.target.value)} disabled={disabled} />
        )}
        {visible("destination") && (
          <Input
            label="Destination"
            value={value.destination}
            onChange={(e) => set("destination", e.target.value)}
            disabled={disabled}
          />
        )}
      </div>

      {visible("cargoMode") && (
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
      )}

      {value.cargoMode === "LCL_AIR" && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visible("packageCount") && (
              <Input
                label="No. of Packages"
                type="number"
                value={value.packageCount ?? ""}
                onChange={(e) => set("packageCount", numOrNull(e.target.value))}
                disabled={disabled}
              />
            )}
            <Input
              label="Weight"
              type="number"
              value={value.weight ?? ""}
              onChange={(e) => set("weight", numOrNull(e.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <Input
              label="Length"
              type="number"
              value={value.length ?? ""}
              onChange={(e) => set("length", numOrNull(e.target.value))}
              disabled={disabled}
            />
            <Input
              label="Width"
              type="number"
              value={value.width ?? ""}
              onChange={(e) => set("width", numOrNull(e.target.value))}
              disabled={disabled}
            />
            <Input
              label="Height"
              type="number"
              value={value.height ?? ""}
              onChange={(e) => set("height", numOrNull(e.target.value))}
              disabled={disabled}
            />
            <Select
              label="Unit"
              placeholder="Select..."
              value={value.dimensionUnit}
              onChange={(e) => set("dimensionUnit", e.target.value as TransportDetailState["dimensionUnit"])}
              options={[...DIMENSION_UNIT_OPTIONS]}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {value.cargoMode === "FCL" && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Input
            label="Weight"
            type="number"
            value={value.fclWeight ?? ""}
            onChange={(e) => set("fclWeight", numOrNull(e.target.value))}
            disabled={disabled}
          />
          {visible("containerType") && (
            <Input
              label="Container Type"
              value={value.containerType}
              onChange={(e) => set("containerType", e.target.value)}
              disabled={disabled}
            />
          )}
          {visible("deliveryType") && (
            <Select
              label="Delivery Type"
              placeholder="Select..."
              value={value.deliveryType}
              onChange={(e) => set("deliveryType", e.target.value as TransportDetailState["deliveryType"])}
              options={[...DELIVERY_TYPE_OPTIONS]}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}
