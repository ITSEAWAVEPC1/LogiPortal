"use client";

import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40 lg:items-center lg:justify-center lg:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative h-[100dvh] w-full overflow-y-auto bg-surface p-6 shadow-lg",
          "lg:h-auto lg:max-h-[90dvh] lg:w-full lg:max-w-md lg:rounded-lg lg:border lg:border-border-subtle",
          className,
        )}
      >
        {title && <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>}
        {children}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
        >
          ×
        </button>
      </div>
    </div>
  );
}
