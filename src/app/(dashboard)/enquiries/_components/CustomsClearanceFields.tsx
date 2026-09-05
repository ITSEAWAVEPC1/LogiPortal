"use client";

import { Button, Input } from "@/components/ui";
import type { FieldConfigEntry } from "@/lib/enquiries/field-config-keys";

export interface CommodityLineState {
  hsCode: string;
  commodity: string;
}

export interface CustomsDetailState {
  commodityLines: CommodityLineState[];
}

const EMPTY_LINE: CommodityLineState = { hsCode: "", commodity: "" };

export const EMPTY_CUSTOMS_DETAIL: CustomsDetailState = { commodityLines: [{ ...EMPTY_LINE }] };

interface CustomsClearanceFieldsProps {
  value: CustomsDetailState;
  onChange: (value: CustomsDetailState) => void;
  disabled?: boolean;
  // Admin-configured visibility per field key (Stage 12c) — missing entries
  // default to visible, matching the DB-side default.
  fieldConfig?: Record<string, FieldConfigEntry>;
}

export function CustomsClearanceFields({ value, onChange, disabled, fieldConfig }: CustomsClearanceFieldsProps) {
  if (fieldConfig?.commodityLines?.isVisible === false) return null;

  function updateLine(index: number, patch: Partial<CommodityLineState>) {
    onChange({
      commodityLines: value.commodityLines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    });
  }

  function addLine() {
    onChange({ commodityLines: [...value.commodityLines, { ...EMPTY_LINE }] });
  }

  function removeLine(index: number) {
    onChange({ commodityLines: value.commodityLines.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Customs Clearance Details</h3>
        {!disabled && (
          <Button size="sm" variant="ghost" onClick={addLine}>
            + Add commodity line
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {value.commodityLines.map((line, index) => (
          <div key={index} className="flex items-end gap-2 rounded-md border border-border-subtle p-2">
            <Input
              label="HS Code"
              value={line.hsCode}
              onChange={(e) => updateLine(index, { hsCode: e.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              label="Commodity"
              value={line.commodity}
              onChange={(e) => updateLine(index, { commodity: e.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            {!disabled && value.commodityLines.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => removeLine(index)}>
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
