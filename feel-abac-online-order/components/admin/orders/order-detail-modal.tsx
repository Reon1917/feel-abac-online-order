"use client";

import { useMemo } from "react";
import clsx from "clsx";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import type { OrderRecord } from "@/lib/orders/types";
import { formatBangkokTimestamp } from "@/lib/timezone";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";
import { ReceiptReviewSection } from "@/components/payments/admin/receipt-review";
import { PaymentBadge } from "@/components/payments/admin/payment-badge";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  order: OrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: AdminOrdersDictionary;
  onOrderUpdated?: () => void;
};

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number | null | undefined) {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return currencyFormatter.format(safe);
}

export function OrderDetailModal({
  order,
  open,
  onOpenChange,
  dictionary,
  onOrderUpdated,
}: Props) {
  const foodPayment = useMemo(
    () => order?.payments?.find((p) => p.type === "food") ?? null,
    [order?.payments]
  );

  if (!order) {
    return null;
  }

  const deliveryLabel =
    order.deliveryMode === "custom"
      ? `${order.customCondoName ?? "Custom Location"}${
          order.customBuildingName ? `, ${order.customBuildingName}` : ""
        }`
      : order.deliveryLocationId
        ? "Preset Location"
        : "-";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold sm:text-2xl">
              <span className="text-slate-500">{dictionary.orderIdLabel}</span>{" "}
              <span className="text-emerald-600">{order.displayId}</span>
            </DialogTitle>
            <span
              className={clsx(
                "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold sm:px-4 sm:py-1.5 sm:text-sm",
                statusBadgeClass(order.status)
              )}
            >
              {statusLabel(order.status, dictionary)}
            </span>
          </div>
        </DialogHeader>

        {/* Customer Info - Compact grid for long addresses */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">{dictionary.customerLabel}</span>
              <span className="font-semibold text-slate-900 wrap-break-word">{order.customerName}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">
                {dictionary.phoneLabel ?? "Phone"}
              </span>
              <span className="font-semibold text-slate-900">{order.customerPhone}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">{dictionary.locationLabel}</span>
              <span className="font-semibold text-slate-900 wrap-break-word leading-snug">{deliveryLabel}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">{dictionary.createdLabel ?? "Created"}</span>
              <span className="font-semibold text-slate-900">{formatBangkokTimestamp(order.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        {foodPayment && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Payment:</span>
            <PaymentBadge payment={foodPayment} />
          </div>
        )}

        {/* Receipt Review Section - shows when awaiting verification */}
        {foodPayment && (
          <ReceiptReviewSection
            order={order}
            payment={foodPayment}
            onVerified={() => {
              onOrderUpdated?.();
              onOpenChange(false);
            }}
            onRejected={() => {
              onOrderUpdated?.();
              onOpenChange(false);
            }}
          />
        )}

        {/* Order Items - Table/Kitchen Receipt Style */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">
            {dictionary.itemsTitle ?? "Items"}
          </h3>
          <div className="rounded-2xl border border-slate-200 bg-white">
            {/* Table Header */}
            <div className="grid grid-cols-[2.5rem_3.5rem_1fr] gap-3 border-b-2 border-slate-300 bg-slate-100 px-4 py-2 sm:grid-cols-[3rem_4rem_1fr] sm:gap-4 sm:px-5 sm:py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Qty</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Code</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Item</span>
            </div>
            
            {/* Table Body */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 scrollbar-thin scrollbar-thumb-slate-200">
              {order.items.map((item) => {
                const choicesStr = item.choices.length > 0
                  ? item.choices.map((c) => c.optionName).join(", ")
                  : null;

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[2.5rem_3.5rem_1fr] gap-3 px-4 py-3 sm:grid-cols-[3rem_4rem_1fr] sm:gap-4 sm:px-5 sm:py-4"
                  >
                    {/* Quantity - FIRST, large and bold */}
                    <span className="text-lg font-bold text-slate-900 sm:text-xl">
                      {item.quantity}
                    </span>
                    
                    {/* Menu Code */}
                    <span className="font-mono text-xs font-semibold text-slate-500 sm:text-sm">
                      {item.menuCode || "—"}
                    </span>
                    
                    {/* Item Name + Choices/Notes */}
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 wrap-break-word sm:text-base">
                        {item.menuItemName}
                      </p>
                      {choicesStr && (
                        <p className="text-xs text-slate-600 wrap-break-word sm:text-sm">
                          {choicesStr}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs italic text-amber-700 wrap-break-word sm:text-sm">
                          → {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Subtotal Footer */}
            <div className="border-t-2 border-slate-300 bg-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">
                  {dictionary.subtotalLabel ?? "Subtotal"}
                </span>
                <span className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(order.orderNote || order.deliveryNotes) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {order.orderNote && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {dictionary.orderNoteLabel ?? "Order Note"}
                </p>
                <p className="mt-1 text-sm text-slate-700 wrap-break-word">{order.orderNote}</p>
              </div>
            )}
            {order.deliveryNotes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {dictionary.deliveryNoteLabel ?? "Delivery Note"}
                </p>
                <p className="mt-1 text-sm text-slate-700 wrap-break-word">{order.deliveryNotes}</p>
              </div>
            )}
          </div>
        )}

        {order.status === "cancelled" && order.cancelReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>{dictionary.statusCancelled ?? "Rejected"}:</strong> {order.cancelReason}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
