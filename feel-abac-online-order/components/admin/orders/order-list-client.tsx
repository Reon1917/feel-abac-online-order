'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";

import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
} from "@/lib/orders/events";
import type { OrderAdminSummary, OrderRecord, OrderStatus } from "@/lib/orders/types";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  initialOrders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
  locale: Locale;
};

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

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function statusBadgeClass(status: OrderStatus) {
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "order_in_kitchen" || status === "order_out_for_delivery" || status === "delivered") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case "order_processing":
      return "Processing";
    case "awaiting_food_payment":
      return "Awaiting Food Payment";
    case "food_payment_review":
      return "Food Payment Review";
    case "order_in_kitchen":
      return "In Kitchen";
    case "order_out_for_delivery":
      return "Out for Delivery";
    case "awaiting_delivery_fee_payment":
      return "Awaiting Delivery Fee";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function OrderListClient({ initialOrders, dictionary, locale }: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }
    const channel = pusher.subscribe(ADMIN_ORDERS_CHANNEL);

    const handleSubmitted = async (payload: OrderSubmittedPayload) => {
      toast.success(dictionary.newOrderToast);
      try {
        const response = await fetch(`/api/orders/${payload.displayId}`, {
          cache: "no-store",
        });
        const json = await response.json().catch(() => null);
        const order = json?.order as OrderRecord | undefined;
        if (!response.ok || !order) {
          throw new Error(dictionary.errorLoading);
        }

        const deliveryLabel =
          order.deliveryMode === "custom"
            ? `${order.customCondoName ?? ""}${
                order.customBuildingName ? `, ${order.customBuildingName}` : ""
              }`
            : payload.deliveryLabel;

        const summary: OrderAdminSummary = {
          id: order.id,
          displayId: order.displayId,
          status: order.status,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          totalAmount: order.totalAmount,
          deliveryLabel,
          createdAt: order.createdAt,
        } as OrderAdminSummary;

        setOrders((prev) => [summary, ...prev]);
      } catch {
        toast.error(dictionary.errorLoading);
      }
    };

    const handleStatusChanged = (payload: OrderStatusChangedPayload) => {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: payload.toStatus, createdAt: payload.at }
            : order
        )
      );
      toast.message(dictionary.statusUpdatedToast);
    };

    channel.bind(ORDER_SUBMITTED_EVENT, handleSubmitted);
    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);

    return () => {
      channel.unbind(ORDER_SUBMITTED_EVENT, handleSubmitted);
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);
      pusher.unsubscribe(ADMIN_ORDERS_CHANNEL);
    };
  }, [dictionary.errorLoading, dictionary.newOrderToast, dictionary.statusUpdatedToast]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {dictionary.listTitle}
        </h2>
        <span className="text-sm font-medium text-slate-500">
          {orders.length} orders
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          {dictionary.emptyState}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {dictionary.orderIdLabel} {order.displayId}
                  </span>
                  <span
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                      statusBadgeClass(order.status)
                    )}
                  >
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  {dictionary.customerLabel}: {order.customerName} · {order.customerPhone}
                </p>
                <p className="text-sm text-slate-600">
                  {dictionary.locationLabel}: {order.deliveryLabel}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-base font-semibold text-slate-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTimestamp(order.createdAt)}
                  </p>
                </div>
                <Link
                  href={withLocalePath(locale, `/orders/${order.displayId}`)}
                  className="inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {dictionary.viewOrder}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
