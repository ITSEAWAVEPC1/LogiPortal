"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions {
  delay?: number;
  enabled?: boolean;
}

/** Debounced save-on-change. Skips the initial mount and no-op (unchanged) values. */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, options: UseAutosaveOptions = {}) {
  const { delay = 800, enabled = true } = options;
  const debounced = useDebouncedValue(value, delay);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const isFirstRun = useRef(true);
  const lastSavedRef = useRef<string>(JSON.stringify(value));
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!enabled) return;

    const serialized = JSON.stringify(debounced);
    if (serialized === lastSavedRef.current) return;

    let cancelled = false;
    setStatus("saving");
    saveRef
      .current(debounced)
      .then(() => {
        if (cancelled) return;
        lastSavedRef.current = serialized;
        setStatus("saved");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, enabled]);

  return { status };
}
