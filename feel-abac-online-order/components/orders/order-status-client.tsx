'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import type orderDictionary from "@/dictionaries/en/order.json";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ORDER_STATUS_CHANGED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
} from "@/lib/orders/events";
import type { OrderRecord, OrderStatus } from "@/lib/orders/types";

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

    const handleStatusChange = (payload: OrderStatusChangedPayload) => {
      if (payload.orderId !== order.id) return;
      setOrder((prev) => ({
        ...prev,
        status: payload.toStatus,
        updatedAt: payload.at,
        cancelledAt:
          payload.toStatus === "cancelled" ? payload.at : prev.cancelledAt,
        cancelReason: payload.reason ?? prev.cancelReason,
        isClosed: payload.toStatus === "cancelled" ? true : prev.isClosed,
      }));
      void refreshOrder();
    };

    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);

    return () => {
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);
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
          {!cancelled && order.status === "order_processing" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {dictionary.orderProcessingSubtitle}
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

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {dictionary.adminActionsLabel}
            </h3>
            {order.status === "order_in_kitchen" ? (
              <span className="text-sm font-medium text-emerald-700">
                {dictionary.accepted}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={
                actionState !== "idle" ||
                order.status === "order_in_kitchen" ||
                order.status === "cancelled"
              }
              onClick={() => void handleAdminAction("accept")}
            >
              {actionState === "accepting"
                ? dictionary.accepting
                : dictionary.acceptOrder}
            </button>
            <div className="flex-1 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                {dictionary.cancelReasonLabel}
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder={dictionary.cancelReasonLabel}
                disabled={actionState === "accepting"}
              />
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  actionState !== "idle" || order.status === "cancelled"
                }
                onClick={() => void handleAdminAction("cancel")}
              >
                {actionState === "cancelling"
                  ? dictionary.cancelling
                  : dictionary.cancelOrder}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
