"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ColumnDef {
  key: string;
  label: string;
}

interface ColumnPickerProps {
  open: boolean;
  onClose: () => void;
  /** All columns this screen can show, in their canonical/default order. */
  columns: ColumnDef[];
  /** Currently selected column keys, in display order. */
  selected: string[];
  /** Selection to restore via "Load Default". */
  defaultSelected: string[];
  onApply: (selected: string[]) => void;
}

// Generic Available/Selected dual-list column picker, matching the reference
// UI's "Customize Columns" popup. Screen-agnostic by design (keys/labels are
// caller-supplied) so Reports and other list screens can reuse it later —
// see docs/stage-checklists/customer-master-v2.md.
export function ColumnPicker({ open, onClose, columns, selected, defaultSelected, onApply }: ColumnPickerProps) {
  return (
    <Modal open={open} onClose={onClose} title="Customize Columns" className="max-w-2xl">
      {/* Keyed by identity so state re-initializes on remount instead of via
          a setState-in-effect sync (same pattern as CustomerFormModal). */}
      {open && (
        <ColumnPickerBody columns={columns} selected={selected} defaultSelected={defaultSelected} onApply={onApply} onClose={onClose} />
      )}
    </Modal>
  );
}

function ColumnPickerBody({
  columns,
  selected,
  defaultSelected,
  onApply,
  onClose,
}: {
  columns: ColumnDef[];
  selected: string[];
  defaultSelected: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
}) {
  const [available, setAvailable] = useState<string[]>(() => {
    const selectedSet = new Set(selected);
    return columns.filter((c) => !selectedSet.has(c.key)).map((c) => c.key);
  });
  const [chosen, setChosen] = useState<string[]>(selected);
  const [availablePick, setAvailablePick] = useState<string | null>(null);
  const [chosenPick, setChosenPick] = useState<string | null>(null);

  const labelFor = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

  function moveToSelected(keys: string[]) {
    setAvailable((prev) => prev.filter((k) => !keys.includes(k)));
    setChosen((prev) => [...prev, ...keys.filter((k) => !prev.includes(k))]);
    setAvailablePick(null);
  }

  function moveToAvailable(keys: string[]) {
    setChosen((prev) => prev.filter((k) => !keys.includes(k)));
    setAvailable((prev) => [...prev, ...keys.filter((k) => !prev.includes(k))]);
    setChosenPick(null);
  }

  function loadDefault() {
    const selectedSet = new Set(defaultSelected);
    setAvailable(columns.filter((c) => !selectedSet.has(c.key)).map((c) => c.key));
    setChosen(defaultSelected);
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Available Columns</p>
          <select
            multiple
            size={10}
            value={availablePick ? [availablePick] : []}
            onChange={(e) => setAvailablePick(e.target.value || null)}
            className="w-full rounded-md border border-border-subtle bg-surface p-1 text-sm text-text-primary"
          >
            {available.map((key) => (
              <option key={key} value={key}>
                {labelFor(key)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!availablePick}
            onClick={() => availablePick && moveToSelected([availablePick])}
          >
            &gt;
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={available.length === 0} onClick={() => moveToSelected(available)}>
            &gt;&gt;
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!chosenPick}
            onClick={() => chosenPick && moveToAvailable([chosenPick])}
          >
            &lt;
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={chosen.length === 0} onClick={() => moveToAvailable(chosen)}>
            &lt;&lt;
          </Button>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Selected Columns</p>
          <select
            multiple
            size={10}
            value={chosenPick ? [chosenPick] : []}
            onChange={(e) => setChosenPick(e.target.value || null)}
            className="w-full rounded-md border border-border-subtle bg-surface p-1 text-sm text-text-primary"
          >
            {chosen.map((key) => (
              <option key={key} value={key}>
                {labelFor(key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <Button type="button" variant="ghost" onClick={loadDefault}>
          Load Default
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(chosen);
              onClose();
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
