"use client";

import { Input } from "@/components/ui";

export interface CustomsDetailState {
  hsCode: string;
  commodity: string;
}

export const EMPTY_CUSTOMS_DETAIL: CustomsDetailState = { hsCode: "", commodity: "" };

interface CustomsClearanceFieldsProps {
  value: CustomsDetailState;
  onChange: (value: CustomsDetailState) => void;
  disabled?: boolean;
}

export function CustomsClearanceFields({ value, onChange, disabled }: CustomsClearanceFieldsProps) {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Customs Clearance Details</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="HS Code"
          value={value.hsCode}
          onChange={(e) => onChange({ ...value, hsCode: e.target.value })}
          disabled={disabled}
        />
        <Input
          label="Commodity"
          value={value.commodity}
          onChange={(e) => onChange({ ...value, commodity: e.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
