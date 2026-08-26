"use client";

import { FormEvent, useState } from "react";
import { Button, Modal, Textarea } from "@/components/ui";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}

export function ReviewModal({ open, onClose, onSubmit }: ReviewModalProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(note.trim());
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Flag Back for Correction">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Textarea label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        {error && <p className="text-sm text-status-danger-fg">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? "Submitting..." : "Flag Back"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
