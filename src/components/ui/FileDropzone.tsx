"use client";

import { DragEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
}

export function FileDropzone({ onFileSelected, accept, label = "Click to upload or drag a file here", hint, className }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    onFileSelected(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-brand-teal bg-brand-teal/5" : "border-border-subtle bg-background",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm font-medium text-text-primary">{fileName ?? label}</p>
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}
