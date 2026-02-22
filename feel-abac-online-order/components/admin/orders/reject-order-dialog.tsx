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
  DialogFooter,
} from "@/components/ui/dialog";
import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import type { RefundType } from "@/lib/orders/types";
import { computeOrderTotals } from "@/lib/orders/totals";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

export type CancelOrderData = {
  reason: string;
  refundType?: RefundType;
  refundAmount?: number;
  refundReason?: string;
};

type RejectOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: AdminOrdersDictionary;
  onSubmit: (data: CancelOrderData) => Promise<void> | void;
  isSubmitting?: boolean;
  /** If true, shows refund options */
  hasVerifiedPayment?: boolean;
  /** Order amounts for refund calculation */
  orderAmounts?: {
    subtotal: number;
    vatAmount: number;
    deliveryFee: number | null;
    totalAmount: number;
  };
};

const QUICK_REASON_KEYS = [
  "rejectReasonOutOfStock",
  "rejectReasonClosed",
  "rejectReasonAddress",
  "rejectReasonSlip",
  "rejectReasonOther",
] as const;

type QuickReasonKey = (typeof QUICK_REASON_KEYS)[number];

const REFUND_TYPE_OPTIONS: RefundType[] = ["full", "food_only", "delivery_fee_only", "none"];

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export function RejectOrderDialog({
  open,
  onOpenChange,
  dictionary,
  onSubmit,
  isSubmitting = false,
  hasVerifiedPayment = false,
  orderAmounts,
}: RejectOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<QuickReasonKey | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<CancelOrderData | null>(null);
  
  // Refund state
  const [refundType, setRefundType] = useState<RefundType>("full");
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => {
    if (open) {
      return;
    }
    const timeout = setTimeout(() => {
      setSelectedReason(null);
      setNotes("");
      setError(null);
      setConfirmOpen(false);
      setPendingSubmission(null);
      setRefundType("full");
      setRefundReason("");
    }, 0);
    return () => clearTimeout(timeout);
  }, [open]);

  const resolvedQuickReason = useMemo(() => {
    if (!selectedReason) return "";
    const value = dictionary[selectedReason];
    return typeof value === "string" ? value : "";
  }, [dictionary, selectedReason]);

  // Calculate refund amount based on type
  const calculatedRefundAmount = useMemo(() => {
    if (!orderAmounts) return 0;
    const totals = computeOrderTotals({
      foodSubtotal: orderAmounts.subtotal,
      vatAmount: orderAmounts.vatAmount,
      deliveryFee: orderAmounts.deliveryFee,
    });

    switch (refundType) {
      case "full":
        return orderAmounts.totalAmount;
      case "food_only":
        return totals.foodTotal;
      case "delivery_fee_only":
        return totals.deliveryFee;
      case "none":
        return 0;
      default:
        return 0;
    }
  }, [refundType, orderAmounts]);

  const getRefundTypeLabel = (type: RefundType) => {
    const labels: Record<RefundType, string> = {
      full: dictionary.refundTypeFull ?? "Full Amount",
      food_only: dictionary.refundTypeFoodOnly ?? "Food Payment Only",
      delivery_fee_only: dictionary.refundTypeDeliveryOnly ?? "Delivery Fee Only",
      none: dictionary.refundTypeNone ?? "No Refund Needed",
    };
    return labels[type];
  };

  const handleSelectQuickReason = (key: QuickReasonKey) => {
    setSelectedReason(key);
    setError(null);
    if (!notes.trim()) {
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
    
    const data: CancelOrderData = {
      reason: finalReason,
    };
    
    // Include refund data if payment was verified
    if (hasVerifiedPayment) {
      data.refundType = refundType;
      data.refundAmount = calculatedRefundAmount;
      if (refundReason.trim()) {
        data.refundReason = refundReason.trim();
      }
    }

    setPendingSubmission(data);
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingSubmission) return;
    await onSubmit(pendingSubmission);
  };

  const dialogTitle = hasVerifiedPayment 
    ? (dictionary.cancelWithRefundTitle ?? "Cancel Order")
    : dictionary.rejectDialogTitle;
  
  const dialogDescription = hasVerifiedPayment
    ? (dictionary.cancelWithRefundDescription ?? "Select the refund type for this order.")
    : dictionary.rejectDialogSubtitle;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg md:max-h-[85vh] md:overflow-y-auto md:p-5 lg:max-h-none lg:p-6">
          <DialogHeader>
            <DialogTitle className="text-red-600">{dialogTitle}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-3 lg:space-y-4">
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
                className="min-h-[80px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                placeholder={dictionary.rejectNotesPlaceholder ?? "Add detail"}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  if (error) setError(null);
                }}
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            {/* Refund options - only shown when payment was verified */}
            {hasVerifiedPayment && orderAmounts && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 md:space-y-2 md:p-2.5 lg:space-y-3 lg:p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {dictionary.refundTypeLabel ?? "Refund Type"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:gap-1.5 lg:gap-2">
                    {REFUND_TYPE_OPTIONS.map((type) => {
                      const isActive = refundType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRefundType(type)}
                          className={clsx(
                            "rounded-lg border px-3 py-2 text-sm font-medium transition text-left",
                            isActive
                              ? "border-amber-400 bg-amber-100 text-amber-800"
                              : "border-amber-200 bg-white text-amber-700 hover:border-amber-300"
                          )}
                        >
                          {getRefundTypeLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Refund amount display */}
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-amber-200 md:px-2.5 md:py-1.5 lg:px-3 lg:py-2">
                  <span className="text-sm text-amber-700">
                    {dictionary.refundAmountLabel ?? "Refund Amount"}
                  </span>
                  <span className="text-lg font-bold text-amber-800 md:text-base lg:text-lg">
                    {formatCurrency(calculatedRefundAmount)}
                  </span>
                </div>

                {/* Refund notes */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-amber-700" htmlFor="refund-reason">
                    {dictionary.refundReasonLabel ?? "Refund Notes (optional)"}
                  </label>
                  <textarea
                    id="refund-reason"
                    className="min-h-[60px] w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder={dictionary.refundReasonPlaceholder ?? "e.g., Customer changed mind, order was delayed..."}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </div>
              </div>
            )}

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
                {isSubmitting ? "..." : (hasVerifiedPayment ? (dictionary.cancelSubmit ?? "Cancel Order") : dictionary.rejectSubmit)}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => {
          if (isSubmitting) return;
          setConfirmOpen(nextOpen);
          if (!nextOpen) {
            setPendingSubmission(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Are you sure?</DialogTitle>
            <DialogDescription>
              {hasVerifiedPayment
                ? "Are you sure you want to cancel this order? This action cannot be undone."
                : "Are you sure you want to reject this order? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setPendingSubmission(null);
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              {dictionary.rejectCancel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmSubmit()}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? "..." : (hasVerifiedPayment ? (dictionary.cancelSubmit ?? "Cancel Order") : dictionary.rejectSubmit)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
