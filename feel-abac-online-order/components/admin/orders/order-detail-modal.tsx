"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";

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
import { PaymentBadge } from "@/components/payments/admin/payment-badge";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";

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

function formatOrderItemCode(item: OrderRecord["items"][number]): string {
  const codedChoices = item.choices.filter(
    (choice) => choice.menuCode && choice.menuCode.trim().length > 0
  );

  // If no per-choice codes, fall back to the line-level menu code
  if (codedChoices.length === 0) {
    return item.menuCode ?? "—";
  }

  const baseCodes = codedChoices
    .filter((choice) => choice.selectionRole === "base")
    .map((choice) => choice.menuCode as string);
  const addonCodes = codedChoices
    .filter((choice) => choice.selectionRole !== "base")
    .map((choice) => choice.menuCode as string);

  const parts = [...baseCodes, ...addonCodes];
  if (parts.length === 0) {
    return item.menuCode ?? "—";
  }

  return parts.join(" + ");
}

export function OrderDetailModal({
  order,
  open,
  onOpenChange,
  dictionary,
  onOrderUpdated,
}: Props) {
  const [courierVendor, setCourierVendor] = useState("");
  const [courierTrackingUrl, setCourierTrackingUrl] = useState("");
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [deliverSaving, setDeliverSaving] = useState(false);
  const { menuLocale } = useMenuLocale();

  // Find combined payment
  const combinedPayment = useMemo(
    () => order?.payments?.find((p) => p.type === "combined") ?? null,
    [order?.payments]
  );

  useEffect(() => {
    if (!order) return;
    setCourierVendor(order.courierVendor ?? "");
    setCourierTrackingUrl(order.courierTrackingUrl ?? "");
  }, [order]);

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

  const hasDeliveryInfo =
    Boolean(order.courierTrackingUrl) || typeof order.deliveryFee === "number";

  const handleHandOff = async () => {
    if (!order) return;

    const tracking = courierTrackingUrl.trim();
    if (!tracking) {
      toast.error("Delivery tracking link is required");
      return;
    }

    setHandoffSaving(true);
    try {
      const response = await fetch(
        `/api/admin/orders/${order.displayId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "handed_off",
            courierVendor: courierVendor.trim() || undefined,
            courierTrackingUrl: tracking,
          }),
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to hand off order");
      }

      toast.success(
        dictionary.statusUpdatedToast ?? "Order status updated"
      );
      onOrderUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to hand off order"
      );
    } finally {
      setHandoffSaving(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!order) return;
    setDeliverSaving(true);
    try {
      const response = await fetch(
        `/api/admin/orders/${order.displayId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delivered" }),
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to mark delivered");
      }

      toast.success(
        dictionary.statusUpdatedToast ?? "Order status updated"
      );
      onOrderUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to mark delivered"
      );
    } finally {
      setDeliverSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
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
              {statusLabel(order.status, dictionary, {
                refundStatus: order.refundStatus,
              })}
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
        {combinedPayment && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Payment:</span>
            <PaymentBadge payment={combinedPayment} />
          </div>
        )}

        {/* Delivery / handoff controls */}
        {order.status === "order_in_kitchen" && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {dictionary.handoffSectionTitle ?? "Hand off to delivery"}
            </h3>
            <p className="text-xs text-slate-600">
              Add the delivery tracking link before handing this order to Bolt/Grab.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                {dictionary.handoffVendorLabel ?? "Courier vendor (optional)"}
              </label>
              <input
                type="text"
                value={courierVendor}
                onChange={(e) => setCourierVendor(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Grab, Bolt, etc."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                {dictionary.handoffTrackingLabel ?? "Delivery tracking link"}
              </label>
              <input
                type="url"
                value={courierTrackingUrl}
                onChange={(e) => setCourierTrackingUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Paste Bolt/Grab share link"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={handoffSaving}
                onClick={() => void handleHandOff()}
                className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {handoffSaving
                  ? dictionary.handoffSubmitting ?? "Handing off..."
                  : dictionary.handoffSubmit ?? "Hand off to delivery"}
              </button>
            </div>
          </div>
        )}

        {order.status === "order_out_for_delivery" && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {dictionary.handoffSectionTitle ?? "Handed off to delivery"}
                </h3>
                <p className="text-xs text-slate-600">
                  {dictionary.handoffSummarySubtitle ??
                    "Delivery is now handled by the courier. You can still mark this order as delivered once it is completed."}
                </p>
              </div>
              <button
                type="button"
                disabled={deliverSaving}
                onClick={() => void handleMarkDelivered()}
                className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deliverSaving
                  ? dictionary.markDeliveredSubmitting ?? "Marking delivered..."
                  : dictionary.markDelivered ?? "Mark as delivered"}
              </button>
            </div>
            {hasDeliveryInfo && (
              <dl className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
                {order.courierTrackingUrl && (
                  <div>
                    <dt className="font-medium">
                      {dictionary.handoffTrackingLabel ??
                        "Delivery tracking link"}
                    </dt>
                    <dd className="mt-0.5 break-all">
                      {order.courierTrackingUrl}
                    </dd>
                  </div>
                )}
                {typeof order.deliveryFee === "number" && (
                  <div>
                    <dt className="font-medium">
                      {dictionary.handoffFeeLabel ?? "Delivery fee (THB)"}
                    </dt>
                    <dd className="mt-0.5">
                      {formatCurrency(order.deliveryFee)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}

        {/* Order Items - Table/Kitchen Receipt Style */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">
            {dictionary.itemsTitle ?? "Items"}
          </h3>
          <div className="rounded-2xl border border-slate-200 bg-white">
            {/* Table Header */}
            <div className="grid grid-cols-[3.5rem_1fr_2.5rem] gap-3 border-b-2 border-slate-300 bg-slate-100 px-4 py-2 sm:grid-cols-[4rem_1fr_3rem] sm:gap-4 sm:px-5 sm:py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Code
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Item
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Qty
              </span>
            </div>
            
            {/* Table Body */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 scrollbar-thin scrollbar-thumb-slate-200">
              {order.items.map((item) => {
                const choicesStr =
                  item.choices.length > 0
                    ? item.choices
                        .map((choice) =>
                          menuLocale === "my"
                            ? choice.optionNameMm ?? choice.optionName
                            : choice.optionName
                        )
                        .join(", ")
                    : null;

                const primaryName =
                  menuLocale === "my"
                    ? item.menuItemNameMm ?? item.menuItemName
                    : item.menuItemName;

                const secondaryName =
                  menuLocale === "my"
                    ? item.menuItemName
                    : item.menuItemNameMm ?? null;

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[3.5rem_1fr_2.5rem] gap-3 px-4 py-3 sm:grid-cols-[4rem_1fr_3rem] sm:gap-4 sm:px-5 sm:py-4"
                  >
                    {/* Menu Code */}
                    <span className="font-mono text-xs font-semibold text-slate-500 sm:text-sm">
                      {formatOrderItemCode(item)}
                    </span>
                    
                    {/* Item Name + Choices/Notes */}
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900 wrap-break-word sm:text-base">
                        {primaryName}
                      </p>
                      {secondaryName && (
                        <p className="text-xs text-slate-500 wrap-break-word sm:text-sm">
                          {secondaryName}
                        </p>
                      )}
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

                    {/* Quantity - last column */}
                    <span className="text-right text-lg font-bold text-slate-900 sm:text-xl">
                      {item.quantity}
                    </span>
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
