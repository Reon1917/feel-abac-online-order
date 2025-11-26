'use client';

import { useCallback, useEffect, useState } from "react";
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
import { formatBangkokTimestamp } from "@/lib/timezone";
import { OrderDetailModal } from "./order-detail-modal";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  initialOrders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
};

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function statusBadgeClass(status: OrderStatus) {
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "order_in_kitchen" || status === "order_out_for_delivery" || status === "delivered") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
}

function statusLabel(status: OrderStatus, dictionary: AdminOrdersDictionary) {
  switch (status) {
    case "order_processing":
      return dictionary.statusProcessing ?? "Processing";
    case "awaiting_food_payment":
      return dictionary.statusAwaitingFoodPayment ?? "Awaiting Food Payment";
    case "food_payment_review":
      return dictionary.statusFoodPaymentReview ?? "Food Payment Review";
    case "order_in_kitchen":
      return dictionary.statusKitchen ?? "In Kitchen";
    case "order_out_for_delivery":
      return dictionary.statusOutForDelivery ?? "Out for Delivery";
    case "awaiting_delivery_fee_payment":
      return dictionary.statusAwaitingDeliveryFee ?? "Awaiting Delivery Fee";
    case "delivered":
      return dictionary.statusDelivered ?? "Delivered";
    case "cancelled":
      return dictionary.statusCancelled ?? "Cancelled";
    default:
      return status;
  }
}

export function OrderListClient({ initialOrders, dictionary }: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving">>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const handleViewOrder = useCallback(async (order: OrderAdminSummary) => {
    setLoadingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.displayId}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.order) {
        throw new Error(dictionary.errorLoading);
      }
      setSelectedOrder(json.order as OrderRecord);
      setModalOpen(true);
    } catch {
      toast.error(dictionary.errorLoading);
    } finally {
      setLoadingOrderId(null);
    }
  }, [dictionary.errorLoading]);

  const handleStatusUpdated = useCallback((orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  }, []);

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
          displayDay: order.displayDay,
          status: order.status,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          totalAmount: order.totalAmount,
          deliveryLabel,
          createdAt: order.createdAt,
        };

        setOrders((prev) => [summary, ...prev]);
      } catch {
        toast.error(dictionary.errorLoading);
      }
    };

    const handleStatusChanged = (payload: OrderStatusChangedPayload) => {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: payload.toStatus }
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

  const updateOrderStatus = async (
    order: OrderAdminSummary,
    action: "accept" | "cancel"
  ) => {
    setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
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
      const nextStatus =
        action === "accept" ? "order_in_kitchen" : "cancelled";
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, status: nextStatus } : item
        )
      );
      toast.success(dictionary.statusUpdatedToast);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.errorLoading
      );
    } finally {
      setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
    }
  };

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
                    {statusLabel(order.status, dictionary)}
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
                    {formatBangkokTimestamp(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      order.status === "order_in_kitchen" ||
                      order.status === "cancelled" ||
                      actionState[order.id] === "saving"
                    }
                    onClick={() => void updateOrderStatus(order, "accept")}
                  >
                    {dictionary.accept}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      order.status === "cancelled" ||
                      actionState[order.id] === "saving"
                    }
                    onClick={() => void updateOrderStatus(order, "cancel")}
                  >
                    {dictionary.cancel}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleViewOrder(order)}
                  disabled={loadingOrderId === order.id}
                  className="inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingOrderId === order.id ? "..." : dictionary.viewOrder}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dictionary={dictionary}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}
