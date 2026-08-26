"use client";

import { Button, Input, Select } from "@/components/ui";
import { QUOTATION_CHARGE_CATEGORY_OPTIONS, type QuotationLineItemInput } from "@/lib/validation/quotation";

type Category = QuotationLineItemInput["category"];

interface LineItemsEditorProps {
  items: QuotationLineItemInput[];
  onChange: (items: QuotationLineItemInput[]) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  readOnly: boolean;
}

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED"].map((c) => ({ value: c, label: c }));

export function LineItemsEditor({ items, onChange, currency, onCurrencyChange, readOnly }: LineItemsEditorProps) {
  function itemsForCategory(category: Category) {
    return items.map((item, index) => ({ item, index })).filter((x) => x.item.category === category);
  }

  function updateItem(index: number, patch: Partial<QuotationLineItemInput>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem(category: Category) {
    onChange([...items, { category, description: "", rate: null, quantity: null, amount: 0, currency }]);
  }

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Select
        label="Currency"
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        options={CURRENCY_OPTIONS}
        disabled={readOnly}
        className="w-32"
      />

      {QUOTATION_CHARGE_CATEGORY_OPTIONS.map(({ value: category, label }) => (
        <div key={category}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
            {!readOnly && (
              <Button size="sm" variant="ghost" onClick={() => addItem(category)}>
                + Add line
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {itemsForCategory(category).length === 0 && (
              <p className="text-xs text-text-tertiary">No {label.toLowerCase()} added.</p>
            )}
            {itemsForCategory(category).map(({ item, index }) => (
              <div key={index} className="flex items-end gap-2 rounded-md border border-border-subtle p-2">
                <Input
                  label="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  disabled={readOnly}
                  className="flex-1"
                />
                <Input
                  label="Rate"
                  type="number"
                  value={item.rate ?? ""}
                  onChange={(e) => updateItem(index, { rate: e.target.value === "" ? null : Number(e.target.value) })}
                  disabled={readOnly}
                  className="w-24"
                />
                <Input
                  label="Qty"
                  type="number"
                  value={item.quantity ?? ""}
                  onChange={(e) =>
                    updateItem(index, { quantity: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  disabled={readOnly}
                  className="w-20"
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
      ))}

      <div className="flex justify-between border-t border-border-subtle pt-3 text-base font-semibold text-text-primary">
        <span>Total</span>
        <span>
          {currency} {total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
