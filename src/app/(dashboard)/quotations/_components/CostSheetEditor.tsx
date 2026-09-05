"use client";

import { Button, Input, Select } from "@/components/ui";
import { QUOTATION_CHARGE_CATEGORY_OPTIONS, type QuotationCostLineInput } from "@/lib/validation/quotation";
import { computeAmount, computeBuyRateInr, computeSellRate } from "@/lib/quotations/cost-sheet-math";

type Category = QuotationCostLineInput["category"];

export interface CostSheetState {
  defaultMarginPct: number | null;
  notes: string;
  costLines: QuotationCostLineInput[];
}

interface CostSheetEditorProps {
  value: CostSheetState;
  onChange: (value: CostSheetState) => void;
  readOnly: boolean;
  // Same idea as LineItemsEditor — the bundled enquiry's service types decide
  // which category blocks show an "+ Add cost line" button. REIMBURSEMENT is
  // always allowed. Omit to allow all four.
  availableCategories?: Category[];
}

const BUY_CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED"].map((c) => ({ value: c, label: c }));

function emptyLine(category: Category): QuotationCostLineInput {
  return {
    category,
    description: "",
    vendorName: "",
    buyRate: null,
    buyCurrency: "INR",
    buyExchangeRate: null,
    buyRateInr: null,
    marginPct: null,
    marginFlat: null,
    sellRate: null,
    quantity: null,
    amount: 0,
  };
}

const numOrNull = (raw: string): number | null => (raw === "" ? null : Number(raw));

export function CostSheetEditor({ value, onChange, readOnly, availableCategories }: CostSheetEditorProps) {
  const { defaultMarginPct, notes, costLines } = value;

  function linesForCategory(category: Category) {
    return costLines.map((line, index) => ({ line, index })).filter((x) => x.line.category === category);
  }

  // Recompute buyRateInr / sellRate / amount when an input they depend on
  // changes — but never overwrite a field the user just edited directly (a
  // manual Buy INR / Sell Rate / Amount override sticks until a dependency
  // moves again). Mirrors LineItemsEditor.updateItem.
  function updateLine(index: number, patch: Partial<QuotationCostLineInput>) {
    onChange({
      ...value,
      costLines: costLines.map((line, i) => {
        if (i !== index) return line;
        let next = { ...line, ...patch };
        const buyTouched = "buyRate" in patch || "buyCurrency" in patch || "buyExchangeRate" in patch;
        if (buyTouched) next = { ...next, buyRateInr: computeBuyRateInr(next) };
        if (buyTouched || "marginPct" in patch || "marginFlat" in patch) {
          next = { ...next, sellRate: computeSellRate({ ...next, defaultMarginPct }) };
        }
        if (buyTouched || "marginPct" in patch || "marginFlat" in patch || "quantity" in patch) {
          next = { ...next, amount: computeAmount(next) };
        }
        return next;
      }),
    });
  }

  // A change to the sheet-level default only re-derives lines that don't set
  // their own marginPct.
  function setDefaultMargin(raw: string) {
    const nextDefault = numOrNull(raw);
    onChange({
      ...value,
      defaultMarginPct: nextDefault,
      costLines: costLines.map((line) => {
        if (line.marginPct != null) return line;
        const sellRate = computeSellRate({ ...line, defaultMarginPct: nextDefault });
        return { ...line, sellRate, amount: computeAmount({ ...line, sellRate }) };
      }),
    });
  }

  function removeLine(index: number) {
    onChange({ ...value, costLines: costLines.filter((_, i) => i !== index) });
  }

  function addLine(category: Category) {
    onChange({ ...value, costLines: [...costLines, emptyLine(category)] });
  }

  const costTotal = costLines.reduce((sum, l) => sum + (l.buyRateInr ?? 0) * (l.quantity ?? 0), 0);
  const quotedTotal = costLines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const marginAbs = quotedTotal - costTotal;
  const marginPctText = costTotal > 0 ? `${((marginAbs / costTotal) * 100).toFixed(1)}%` : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Input
          label="Default margin %"
          type="number"
          value={defaultMarginPct ?? ""}
          onChange={(e) => setDefaultMargin(e.target.value)}
          disabled={readOnly}
        />
        <div className="lg:col-span-2">
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            disabled={readOnly}
          />
        </div>
      </div>

      {QUOTATION_CHARGE_CATEGORY_OPTIONS.map(({ value: category, label }) => {
        const rows = linesForCategory(category);
        const isAvailable = !availableCategories || availableCategories.includes(category);
        if (!isAvailable && rows.length === 0) return null;

        return (
          <div key={category}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
              {!readOnly && isAvailable && (
                <Button size="sm" variant="ghost" onClick={() => addLine(category)}>
                  + Add cost line
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {rows.length === 0 && <p className="text-xs text-text-tertiary">No {label.toLowerCase()} added.</p>}
              {rows.map(({ line, index }) => (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-2 rounded-md border border-border-subtle p-2 lg:flex lg:flex-wrap lg:items-end lg:gap-2"
                >
                  <div className="col-span-2 flex items-center justify-between lg:hidden">
                    <span className="text-xs text-text-tertiary">{index + 1}</span>
                    {!readOnly && (
                      <Button size="sm" variant="ghost" onClick={() => removeLine(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <span className="hidden w-6 pb-2 text-xs text-text-tertiary lg:block">{index + 1}</span>
                  <div className="col-span-2 lg:contents">
                    <Input
                      label="Particulars"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      disabled={readOnly}
                      className="lg:min-w-40 lg:flex-1"
                    />
                  </div>
                  <div className="col-span-2 lg:contents">
                    <Input
                      label="Vendor"
                      value={line.vendorName ?? ""}
                      onChange={(e) => updateLine(index, { vendorName: e.target.value })}
                      disabled={readOnly}
                      className="lg:min-w-32 lg:flex-1"
                    />
                  </div>
                  <Input
                    label="Buy Rate"
                    type="number"
                    value={line.buyRate ?? ""}
                    onChange={(e) => updateLine(index, { buyRate: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-24"
                  />
                  <Select
                    label="Buy Cur"
                    value={line.buyCurrency ?? "INR"}
                    onChange={(e) => updateLine(index, { buyCurrency: e.target.value })}
                    options={BUY_CURRENCY_OPTIONS}
                    disabled={readOnly}
                    className="lg:w-20"
                  />
                  {(line.buyCurrency ?? "INR") !== "INR" && (
                    <Input
                      label="Exch"
                      type="number"
                      value={line.buyExchangeRate ?? ""}
                      onChange={(e) => updateLine(index, { buyExchangeRate: numOrNull(e.target.value) })}
                      disabled={readOnly}
                      className="lg:w-20"
                    />
                  )}
                  <Input
                    label="Buy INR"
                    type="number"
                    value={line.buyRateInr ?? ""}
                    onChange={(e) => updateLine(index, { buyRateInr: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-24"
                  />
                  <Input
                    label="Margin %"
                    type="number"
                    value={line.marginPct ?? ""}
                    onChange={(e) => updateLine(index, { marginPct: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-20"
                  />
                  <Input
                    label="Margin Flat"
                    type="number"
                    value={line.marginFlat ?? ""}
                    onChange={(e) => updateLine(index, { marginFlat: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-24"
                  />
                  <Input
                    label="Sell Rate"
                    type="number"
                    value={line.sellRate ?? ""}
                    onChange={(e) => updateLine(index, { sellRate: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-24"
                  />
                  <Input
                    label="Qty"
                    type="number"
                    value={line.quantity ?? ""}
                    onChange={(e) => updateLine(index, { quantity: numOrNull(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-20"
                  />
                  <Input
                    label="Amount"
                    type="number"
                    value={line.amount ?? 0}
                    onChange={(e) => updateLine(index, { amount: Number(e.target.value) })}
                    disabled={readOnly}
                    className="lg:w-28"
                  />
                  {!readOnly && (
                    <Button size="sm" variant="ghost" className="hidden lg:inline-flex" onClick={() => removeLine(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-1 border-t border-border-subtle pt-3 text-sm">
        <div className="flex justify-between text-text-secondary">
          <span>Cost total (buy INR &times; qty)</span>
          <span>INR {costTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-text-secondary">
          <span>Quoted total</span>
          <span>INR {quotedTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-text-primary">
          <span>Margin</span>
          <span>
            INR {marginAbs.toFixed(2)} ({marginPctText})
          </span>
        </div>
      </div>
    </div>
  );
}
