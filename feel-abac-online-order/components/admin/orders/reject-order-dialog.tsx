"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import clsx from "clsx";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type RejectOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: AdminOrdersDictionary;
  onSubmit: (reason: string) => Promise<void> | void;
  isSubmitting?: boolean;
};

const QUICK_REASON_KEYS = [
  "rejectReasonOutOfStock",
  "rejectReasonClosed",
  "rejectReasonAddress",
  "rejectReasonSlip",
  "rejectReasonOther",
] as const;

type QuickReasonKey = (typeof QUICK_REASON_KEYS)[number];

export function RejectOrderDialog({
  open,
  onOpenChange,
  dictionary,
  onSubmit,
  isSubmitting = false,
}: RejectOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<QuickReasonKey | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      return;
    }
    const timeout = setTimeout(() => {
      setSelectedReason(null);
      setNotes("");
      setError(null);
    }, 0);
    return () => clearTimeout(timeout);
  }, [open]);


  const resolvedQuickReason = useMemo(() => {
    if (!selectedReason) return "";
    const value = dictionary[selectedReason];
    return typeof value === "string" ? value : "";
  }, [dictionary, selectedReason]);

  const handleSelectQuickReason = (key: QuickReasonKey) => {
    setSelectedReason(key);
    setError(null);
    if (!notes.trim()) {
      // Pre-fill textarea when empty so admins can tweak wording quickly.
      const label = dictionary[key];
      if (typeof label === "string" && label.length > 0) {
        setNotes(label);
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fallbackReason = resolvedQuickReason.trim();
    const manualReason = notes.trim();
    const finalReason = manualReason || fallbackReason;
    if (!finalReason) {
      setError(dictionary.rejectReasonRequired ?? "Reason is required");
      return;
    }
    setError(null);
    await onSubmit(finalReason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-600">{dictionary.rejectDialogTitle}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {dictionary.rejectDialogSubtitle}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.rejectQuickReasonsLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_REASON_KEYS.map((key) => {
                const label = dictionary[key] as string;
                const isActive = selectedReason === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectQuickReason(key)}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      isActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700" htmlFor="reject-notes">
              {dictionary.rejectNotesLabel}
            </label>
            <textarea
              id="reject-notes"
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder={dictionary.rejectNotesPlaceholder ?? "Add detail"}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                if (error) setError(null);
              }}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              {dictionary.rejectCancel ?? "Cancel"}
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? "..." : dictionary.rejectSubmit}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
