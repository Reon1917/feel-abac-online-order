'use client';

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrderAdminSummary } from "@/lib/orders/types";
import {
  computeOrderTotals,
  ORDER_VAT_PERCENT_LABEL,
} from "@/lib/orders/totals";

/* ---------- Quick-fee presets (THB) ---------- */
const QUICK_FEES = [0, 20, 30, 40, 50, 60, 80, 100, 150] as const;

/* ---------- Currency formatter ---------- */
const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});
function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

/* ---------- Types ---------- */
type Dictionary = {
  acceptModalTitle?: string;
  acceptDeliveryFeeLabel?: string;
  acceptDeliveryFeePlaceholder?: string;
  acceptCustomerPays?: string;
  acceptSubmit?: string;
  acceptSubmitting?: string;
  subtotalLabel?: string;
  vatLabel?: string;
  foodTotalLabel?: string;
  deliveryFeeLabel?: string;
  // fallback strings used when keys are missing
  [key: string]: string | undefined;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderAdminSummary | null;
  dictionary: Dictionary;
  onAccept: (order: OrderAdminSummary, deliveryFee: number) => Promise<boolean>;
};

export function AcceptOrderModal({
  open,
  onOpenChange,
  order,
  dictionary,
  onAccept,
}: Props) {
  const [feeInput, setFeeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- derived fee value ---- */
  const feeValue = feeInput.trim() === "" ? 0 : Number(feeInput);
  const feeIsValid = Number.isFinite(feeValue) && feeValue >= 0;

  /* ---- reset on close ---- */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setFeeInput("");
        setSubmitting(false);
      }
    },
    [onOpenChange],
  );

  /* ---- quick-fee tap ---- */
  const pickFee = useCallback((amount: number) => {
    setFeeInput(String(amount));
    // blur input so keyboard dismisses on tablet
    inputRef.current?.blur();
  }, []);

  /* ---- submit ---- */
  const handleSubmit = useCallback(async () => {
    if (!order || !feeIsValid) return;
    setSubmitting(true);
    const ok = await onAccept(order, feeValue);
    setSubmitting(false);
    if (ok) handleOpenChange(false);
  }, [order, feeIsValid, feeValue, onAccept, handleOpenChange]);

  /* ---- scroll input into view when keyboard opens ---- */
  const handleInputFocus = useCallback(() => {
    // Small delay lets the keyboard finish animating
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  if (!order) return null;

  const totals = computeOrderTotals({
    foodSubtotal: order.subtotal,
    vatAmount: order.vatAmount,
    deliveryFee: feeIsValid ? feeValue : 0,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* ---- Keyboard-safe positioning: pinned to top, short max-height ---- */}
      <DialogContent
        className="
          sm:max-w-md
          top-[2%] translate-y-0
          max-h-[96dvh]
          flex flex-col
          overflow-hidden
          p-0
        "
      >
        {/* ======= FIXED HEADER ======= */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-emerald-600 text-lg">
            {dictionary.acceptModalTitle ?? "Accept Order"}
          </DialogTitle>
        </DialogHeader>

        {/* ======= SCROLLABLE BODY ======= */}
        <div className="flex-1 overflow-y-auto px-5 space-y-4 min-h-0">
          {/* ---- 1. Delivery Fee (primary action — TOP of modal) ---- */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {dictionary.acceptDeliveryFeeLabel ?? "Delivery Fee (THB)"}
            </h4>

            {/* Large numeric input */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">
                ฿
              </span>
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={0}
                step="any"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                onFocus={handleInputFocus}
                placeholder={
                  dictionary.acceptDeliveryFeePlaceholder ??
                  "Enter delivery fee (0 for pickup)"
                }
                className="
                  w-full rounded-xl border border-slate-200
                  pl-8 pr-3 py-3
                  text-lg font-semibold text-slate-900
                  shadow-sm
                  focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100
                "
              />
            </div>

            {/* Quick-fee preset grid */}
            <div className="grid grid-cols-5 gap-2">
              {QUICK_FEES.map((amt) => {
                const active = feeInput === String(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => pickFee(amt)}
                    className={`
                      rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors
                      ${
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      }
                    `}
                  >
                    ฿{amt}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- 2. Compact order summary ---- */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Order Details
            </h4>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Order</span>
                <span className="font-semibold text-slate-900">{order.displayId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location</span>
                <span className="font-medium text-slate-700">{order.deliveryLabel}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="text-slate-500">{dictionary.subtotalLabel ?? "Subtotal"}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.foodSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {dictionary.vatLabel ?? `VAT (${ORDER_VAT_PERCENT_LABEL})`}
                </span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{dictionary.foodTotalLabel ?? "Food Total"}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.foodTotal)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* ======= STICKY FOOTER — always visible above keyboard ======= */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 space-y-3">
          {/* Grand total */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 flex justify-between items-center">
            <span className="text-sm font-medium text-emerald-700">
              {dictionary.acceptCustomerPays ?? "Customer Pays"}
            </span>
            <span className="text-xl font-bold text-emerald-800">
              {formatCurrency(totals.totalAmount)}
            </span>
          </div>

          {/* Action row */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-base py-5"
              disabled={submitting || !feeIsValid}
              onClick={() => void handleSubmit()}
            >
              {submitting
                ? (dictionary.acceptSubmitting ?? "Accepting...")
                : (dictionary.acceptSubmit ?? "Accept Order")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
