"use client";

import { Button, Input, Select } from "@/components/ui";
import { QUOTATION_CHARGE_CATEGORY_OPTIONS, type QuotationLineItemInput } from "@/lib/validation/quotation";

type Category = QuotationLineItemInput["category"];

interface LineItemsEditorProps {
  items: QuotationLineItemInput[];
  onChange: (items: QuotationLineItemInput[]) => void;
  readOnly: boolean;
  // Categories the bundled Enquiry's service types make relevant —
  // REIMBURSEMENT is always offered as a general catch-all regardless.
  // Omit to allow all four (the read-only version-history drill-down uses
  // this so a past version's actual categories are never hidden).
  availableCategories?: Category[];
}

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED"].map((c) => ({ value: c, label: c }));

function emptyItem(category: Category): QuotationLineItemInput {
  return {
    category,
    description: "",
    rate: null,
    quantity: null,
    amount: 0,
    currency: "INR",
    exchangeRate: null,
    rateInr: null,
    remarks: "",
  };
}

// currency === "INR" needs no conversion (rateInr mirrors rate); otherwise
// rateInr = rate * exchangeRate once both are known.
function computeRateInr(item: Pick<QuotationLineItemInput, "currency" | "rate" | "exchangeRate">): number | null {
  if (item.currency === "INR") return item.rate ?? null;
  if (item.rate == null || item.exchangeRate == null) return null;
  return item.rate * item.exchangeRate;
}

export function LineItemsEditor({ items, onChange, readOnly, availableCategories }: LineItemsEditorProps) {
  function itemsForCategory(category: Category) {
    return items.map((item, index) => ({ item, index })).filter((x) => x.item.category === category);
  }

  // Recomputes rateInr (when rate/exchangeRate/currency change) and amount
  // (= quantity * rateInr, when any of those or quantity change) — but never
  // overwrites a field the caller just directly edited (a manual override of
  // Rate INR or Amount sticks until another dependency changes again).
  function updateItem(index: number, patch: Partial<QuotationLineItemInput>) {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        let next = { ...item, ...patch };
        if ("rate" in patch || "exchangeRate" in patch || "currency" in patch) {
          next = { ...next, rateInr: computeRateInr(next) };
        }
        if ("quantity" in patch || "rate" in patch || "exchangeRate" in patch || "currency" in patch) {
          next = { ...next, amount: (next.quantity ?? 0) * (next.rateInr ?? 0) };
        }
        return next;
      }),
    );
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem(category: Category) {
    onChange([...items, emptyItem(category)]);
  }

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {QUOTATION_CHARGE_CATEGORY_OPTIONS.map(({ value: category, label }) => {
        const rows = itemsForCategory(category);
        const isAvailable = !availableCategories || availableCategories.includes(category);
        if (!isAvailable && rows.length === 0) return null;

        return (
          <div key={category}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
              {!readOnly && isAvailable && (
                <Button size="sm" variant="ghost" onClick={() => addItem(category)}>
                  + Add line
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {rows.length === 0 && <p className="text-xs text-text-tertiary">No {label.toLowerCase()} added.</p>}
              {rows.map(({ item, index }) => (
                <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border-subtle p-2">
                  <span className="w-6 pb-2 text-xs text-text-tertiary">{index + 1}</span>
                  <Input
                    label="Particulars"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    disabled={readOnly}
                    className="min-w-40 flex-1"
                  />
                  <Select
                    label="Currency"
                    value={item.currency}
                    onChange={(e) => updateItem(index, { currency: e.target.value })}
                    options={CURRENCY_OPTIONS}
                    disabled={readOnly}
                    className="w-24"
                  />
                  <Input
                    label="Qty"
                    type="number"
                    value={item.quantity ?? ""}
                    onChange={(e) => updateItem(index, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
                    disabled={readOnly}
                    className="w-20"
                  />
                  <Input
                    label="Rate"
                    type="number"
                    value={item.rate ?? ""}
                    onChange={(e) => updateItem(index, { rate: e.target.value === "" ? null : Number(e.target.value) })}
                    disabled={readOnly}
                    className="w-24"
                  />
                  {item.currency !== "INR" && (
                    <Input
                      label="Exchange Rate"
                      type="number"
                      value={item.exchangeRate ?? ""}
                      onChange={(e) =>
                        updateItem(index, { exchangeRate: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      disabled={readOnly}
                      className="w-24"
                    />
                  )}
                  <Input
                    label="Rate INR"
                    type="number"
                    value={item.rateInr ?? ""}
                    onChange={(e) => updateItem(index, { rateInr: e.target.value === "" ? null : Number(e.target.value) })}
                    disabled={readOnly}
                    className="w-24"
                  />
                  <Input
                    label="Remarks"
                    value={item.remarks ?? ""}
                    onChange={(e) => updateItem(index, { remarks: e.target.value })}
                    disabled={readOnly}
                    className="min-w-32 flex-1"
                  />
                  <Input
                    label="Amount"
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateItem(index, { amount: Number(e.target.value) })}
                    disabled={readOnly}
                    className="w-28"
                  />
                  {!readOnly && (
                    <Button size="sm" variant="ghost" onClick={() => removeItem(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-between border-t border-border-subtle pt-3 text-base font-semibold text-text-primary">
        <span>Total</span>
        <span>INR {total.toFixed(2)}</span>
      </div>
    </div>
  );
}
