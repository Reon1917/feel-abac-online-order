'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import type orderDictionary from "@/dictionaries/en/order.json";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_CLOSED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
  type OrderClosedPayload,
} from "@/lib/orders/events";
import type { OrderRecord, OrderStatus } from "@/lib/orders/types";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type OrderDictionary = typeof orderDictionary;

type Props = {
  initialOrder: OrderRecord;
  dictionary: OrderDictionary;
  isAdmin: boolean;
};

const STATUS_STEPS: Array<{ key: OrderStatus; labelKey: keyof OrderDictionary }> =
  [
    { key: "order_processing", labelKey: "statusProcessing" },
    { key: "order_in_kitchen", labelKey: "statusKitchen" },
    { key: "order_out_for_delivery", labelKey: "statusOutForDelivery" },
    { key: "delivered", labelKey: "statusDelivered" },
  ];

function statusLabel(status: OrderStatus, dictionary: OrderDictionary) {
  switch (status) {
    case "order_processing":
      return dictionary.statusProcessing;
    case "awaiting_food_payment":
      return dictionary.statusAwaitingFoodPayment;
    case "order_in_kitchen":
      return dictionary.statusKitchen;
    case "order_out_for_delivery":
      return dictionary.statusOutForDelivery;
    case "awaiting_delivery_fee_payment":
      return dictionary.statusAwaitingDeliveryFee;
    case "delivered":
      return dictionary.statusDelivered;
    case "cancelled":
      return dictionary.statusCancelled;
    default:
      return status;
  }
}

function resolveStep(status: OrderStatus) {
  switch (status) {
    case "order_processing":
    case "awaiting_food_payment":
      return 0;
    case "order_in_kitchen":
      return 1;
    case "order_out_for_delivery":
    case "awaiting_delivery_fee_payment":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCurrency(amount: number | null | undefined) {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return currencyFormatter.format(safe);
}

function formatTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export function OrderStatusClient({ initialOrder, dictionary, isAdmin }: Props) {
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionState, setActionState] = useState<"idle" | "accepting" | "cancelling">("idle");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Track seen event IDs to prevent duplicate processing on reconnect
  const seenEventsRef = useRef<Set<string>>(new Set());

  const currentStep = useMemo(
    () => resolveStep(order.status),
    [order.status]
  );

  const refreshOrder = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.displayId}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.order) {
        setError(payload?.error ?? dictionary.orderNotFound);
        return;
      }
      setOrder(payload.order as OrderRecord);
    } catch (err) {
      setError(dictionary.orderNotFound);
    } finally {
      setIsRefreshing(false);
    }
  }, [dictionary.orderNotFound, order.displayId]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }
    const channelName = buildOrderChannelName(order.displayId);
    const channel = pusher.subscribe(channelName);
    const seenEvents = seenEventsRef.current;

    const handleStatusChange = (payload: OrderStatusChangedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      if (payload.orderId !== order.id) return;
      
      // Update order state - let UI show the new status
      setOrder((prev) => ({
        ...prev,
        status: payload.toStatus,
        updatedAt: payload.at,
        cancelledAt:
          payload.toStatus === "cancelled" ? payload.at : prev.cancelledAt,
        cancelReason: payload.reason ?? prev.cancelReason,
        isClosed: payload.toStatus === "cancelled" || payload.toStatus === "delivered",
      }));
      
      // Only refresh for non-terminal states
      if (payload.toStatus !== "cancelled" && payload.toStatus !== "delivered") {
        void refreshOrder();
      }
    };

    const handleClosed = (payload: OrderClosedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      if (payload.orderId !== order.id) return;
      
      // Update order state with final status - let UI show the closed state
      setOrder((prev) => ({
        ...prev,
        status: payload.finalStatus,
        updatedAt: payload.at,
        isClosed: true,
        closedAt: payload.at,
        cancelledAt: payload.finalStatus === "cancelled" ? payload.at : prev.cancelledAt,
        cancelReason: payload.reason ?? prev.cancelReason,
      }));
      // Don't redirect - let user see the cancelled/delivered UI and click "Back to Menu"
    };

    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);
    channel.bind(ORDER_CLOSED_EVENT, handleClosed);

    return () => {
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);
      channel.unbind(ORDER_CLOSED_EVENT, handleClosed);
      pusher.unsubscribe(channelName);
    };
  }, [order.displayId, order.id, refreshOrder]);

  const handleAdminAction = useCallback(
    async (action: "accept" | "cancel") => {
      setError(null);
      setActionState(action === "accept" ? "accepting" : "cancelling");
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action,
              reason: action === "cancel" ? cancelReason : undefined,
            }),
          }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error ?? dictionary.statusUpdateFailed
          );
        }

        await refreshOrder();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : dictionary.statusUpdateFailed
        );
      } finally {
        setActionState("idle");
      }
    },
    [cancelReason, dictionary.statusUpdateFailed, order.displayId, refreshOrder]
  );

  const statusText = statusLabel(order.status, dictionary);
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const isClosed = cancelled || delivered;

  // Handle cleanup and navigation back to menu
  const handleBackToMenu = useCallback(() => {
    // Clear localStorage
    try {
      localStorage.removeItem("lastOrderDisplayId");
    } catch {
      // ignore
    }
    
    // Unsubscribe from Pusher channel
    const pusher = getPusherClient();
    if (pusher) {
      pusher.unsubscribe(buildOrderChannelName(order.displayId));
    }
    
    // Navigate to menu
    const locale = window.location.pathname.split("/")[1] as Locale;
    window.location.href = withLocalePath(locale, "/menu");
  }, [order.displayId]);

  useEffect(() => {
    try {
      if (isClosed) {
        localStorage.removeItem("lastOrderDisplayId");
      } else {
        localStorage.setItem("lastOrderDisplayId", order.displayId);
      }
    } catch {
      // ignore storage failures
    }
  }, [order.displayId, isClosed]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">
              {dictionary.orderIdLabel} {order.displayId}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {dictionary.pageTitle}
            </h1>
            <p className="text-sm text-slate-500">
              {dictionary.lastUpdated}: {formatTimestamp(order.updatedAt)}
            </p>
          </div>
          <span
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
              cancelled
                ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
            )}
          >
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                cancelled ? "bg-red-500" : "bg-emerald-500"
              )}
            />
            {statusText}
          </span>
        </div>
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {dictionary.trackerLabel}
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {STATUS_STEPS.map((step, index) => {
              const reached = currentStep >= index;
              return (
                <div
                  key={step.key}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl border px-3 py-3",
                    reached
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div
                    className={clsx(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                      reached
                        ? "border-emerald-500 bg-white text-emerald-700"
                        : "border-slate-300 bg-white text-slate-400"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    {dictionary[step.labelKey] as string}
                  </div>
                </div>
              );
            })}
          </div>
          {cancelled && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dictionary.cancelledCopy}
              {order.cancelReason ? ` - ${order.cancelReason}` : null}
            </div>
          )}
          {delivered && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {dictionary.deliveredCopy ?? "Your order has been delivered. Thank you!"}
            </div>
          )}
          {!isClosed && order.status === "order_processing" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {dictionary.orderProcessingSubtitle}
            </div>
          )}
          {isClosed && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleBackToMenu}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {dictionary.backToMenu ?? "Back to Menu"}
              </button>
            </div>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {dictionary.itemsLabel}
          </h2>
          <button
            type="button"
            onClick={() => void refreshOrder()}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            disabled={isRefreshing}
          >
            {isRefreshing ? "..." : dictionary.refresh}
          </button>
        </div>
        <div className="mt-4 divide-y divide-slate-200">
          {order.items.map((item) => (
            <div key={item.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {item.menuItemName}
                  </p>
                  {item.menuCode ? (
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {item.menuCode}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  ) : null}
                  <div className="mt-2 text-sm text-slate-600">
                    {item.choices.length === 0
                      ? dictionary.noChoices
                      : item.choices.map((choice) => (
                          <div key={choice.id} className="flex gap-2">
                            <span className="text-slate-500">•</span>
                            <span>
                              {choice.groupName}: {choice.optionName}
                            </span>
                          </div>
                        ))}
                  </div>
                </div>
                <div className="text-right text-sm text-slate-700">
                  <div className="font-semibold">
                    {dictionary.quantityLabel}: {item.quantity}
                  </div>
                  <div className="text-slate-600">
                    {formatCurrency(item.totalPrice)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span>{dictionary.subtotalLabel}</span>
            <span className="font-semibold">
              {formatCurrency(order.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{dictionary.deliveryFeeLabel}</span>
            <span className="font-semibold">
              {formatCurrency(order.deliveryFee)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-slate-900">
            <span>{dictionary.orderTotalLabel}</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dictionary.orderNoteLabel}
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {order.orderNote ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dictionary.deliveryNoteLabel}
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {order.deliveryNotes ?? "-"}
          </p>
        </div>
      </section>

      {/* Admin actions removed on user-facing page; admins manage via admin orders list */}
    </div>
  );
}
