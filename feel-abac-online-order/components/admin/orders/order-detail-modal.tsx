"use client";

import { useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import type { OrderRecord, OrderStatus } from "@/lib/orders/types";
import { formatBangkokTimestamp } from "@/lib/timezone";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  order: OrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: AdminOrdersDictionary;
  onStatusUpdated?: (orderId: string, newStatus: OrderStatus) => void;
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
  onStatusUpdated,
}: Props) {
  const [actionState, setActionState] = useState<"idle" | "accepting" | "cancelling">("idle");

  if (!order) {
    return null;
  }

  const handleAction = async (action: "accept" | "cancel") => {
    setActionState(action === "accept" ? "accepting" : "cancelling");
    try {
      const response = await fetch(`/api/admin/orders/${order.displayId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update order");
      }
      const nextStatus: OrderStatus =
        action === "accept" ? "awaiting_food_payment" : "cancelled";
      onStatusUpdated?.(order.id, nextStatus);
      toast.success(dictionary.statusUpdatedToast);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.errorLoading);
    } finally {
      setActionState("idle");
    }
  };

  const deliveryLabel =
    order.deliveryMode === "custom"
      ? `${order.customCondoName ?? "Custom Location"}${
          order.customBuildingName ? `, ${order.customBuildingName}` : ""
        }`
      : order.deliveryLocationId
        ? "Preset Location"
        : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold sm:text-2xl">
              {dictionary.orderIdLabel} {order.displayId}
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
              <span className="font-semibold text-slate-900 break-words">{order.customerName}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">
                {dictionary.phoneLabel ?? "Phone"}
              </span>
              <span className="font-semibold text-slate-900">{order.customerPhone}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">{dictionary.locationLabel}</span>
              <span className="font-semibold text-slate-900 break-words leading-snug">{deliveryLabel}</span>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]">
              <span className="text-slate-500">{dictionary.createdLabel ?? "Created"}</span>
              <span className="font-semibold text-slate-900">{formatBangkokTimestamp(order.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Order Items - Table/Kitchen Receipt Style */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">
            {dictionary.itemsTitle ?? "Items"}
          </h3>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2.5rem_3.5rem_1fr] gap-3 border-b-2 border-slate-300 bg-slate-100 px-4 py-2 sm:grid-cols-[3rem_4rem_1fr] sm:gap-4 sm:px-5 sm:py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Qty</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Code</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Item</span>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-slate-200">
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
                      <p className="text-sm font-semibold text-slate-900 break-words sm:text-base">
                        {item.menuItemName}
                      </p>
                      {choicesStr && (
                        <p className="text-xs text-slate-600 break-words sm:text-sm">
                          {choicesStr}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs italic text-amber-700 break-words sm:text-sm">
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
                <p className="mt-1 text-sm text-slate-700 break-words">{order.orderNote}</p>
              </div>
            )}
            {order.deliveryNotes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {dictionary.deliveryNoteLabel ?? "Delivery Note"}
                </p>
                <p className="mt-1 text-sm text-slate-700 break-words">{order.deliveryNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={actionState !== "idle"}
              onClick={() => void handleAction("cancel")}
            >
              {actionState === "cancelling" ? "..." : dictionary.cancel}
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                order.status !== "order_processing" ||
                actionState !== "idle"
              }
              onClick={() => void handleAction("accept")}
            >
              {actionState === "accepting" ? "..." : dictionary.accept}
            </button>
          </div>
        )}

        {order.status === "cancelled" && order.cancelReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Cancelled:</strong> {order.cancelReason}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
