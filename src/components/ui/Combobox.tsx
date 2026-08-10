"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  /** Opaque payload passed straight through to onChange — lets callers carry
   *  more than {value, label} through selection (e.g. a full record) without
   *  Combobox needing to know its shape. */
  data?: unknown;
}

interface ComboboxProps {
  /** Selected option's id. */
  value: string;
  /** Label to show for the current value when not actively searching — the
   *  caller owns this alongside `value` (e.g. from a server-fetched record),
   *  since the Combobox itself only knows the labels of its search results. */
  displayValue: string;
  onChange: (value: string, option?: ComboboxOption) => void;
  fetchOptions: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  label?: string;
  /** Rendered below the results list, e.g. a "+ Create new" action. */
  footer?: ReactNode;
  className?: string;
}

export function Combobox({
  value,
  displayValue,
  onChange,
  fetchOptions,
  placeholder = "Search...",
  label,
  footer,
  className,
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Deferred a tick so this isn't a direct setState-during-effect-body call.
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    fetchOptions(debouncedQuery)
      .then((results) => {
        if (!cancelled) setOptions(results);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, fetchOptions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(option: ComboboxOption) {
    setQuery("");
    setOpen(false);
    onChange(option.value, option);
  }

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1", className)}>
      {label && <label className="text-sm font-medium text-text-primary">{label}</label>}
      <input
        type="text"
        value={open ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-teal"
      />
      {open && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border-subtle bg-surface shadow-lg">
          <ul className="max-h-60 overflow-y-auto py-1">
            {loading && <li className="px-3 py-2 text-sm text-text-tertiary">Searching...</li>}
            {!loading && options.length === 0 && <li className="px-3 py-2 text-sm text-text-tertiary">No matches.</li>}
            {!loading &&
              options.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm hover:bg-background",
                      option.value === value ? "bg-brand-teal/10 text-brand-teal" : "text-text-primary",
                    )}
                  >
                    <div>{option.label}</div>
                    {option.description && <div className="text-xs text-text-tertiary">{option.description}</div>}
                  </button>
                </li>
              ))}
          </ul>
          {footer && <div className="border-t border-border-subtle p-1">{footer}</div>}
        </div>
      )}
    </div>
  );
}
