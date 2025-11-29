'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";

import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  ORDER_CLOSED_EVENT,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
  type OrderClosedPayload,
} from "@/lib/orders/events";
import type { OrderAdminSummary, OrderRecord } from "@/lib/orders/types";
import { formatBangkokTimestamp } from "@/lib/timezone";
import { OrderDetailModal } from "./order-detail-modal";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";
import { RejectOrderDialog } from "./reject-order-dialog";

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

export function OrderListClient({ initialOrders, dictionary }: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving">>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderAdminSummary | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  
  // Track seen event IDs to prevent duplicate processing on reconnect
  const seenEventsRef = useRef<Set<string>>(new Set());

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

  const updateOrderStatus = useCallback(async (
    order: OrderAdminSummary,
    action: "accept" | "cancel",
    reason?: string
  ) => {
    setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
    try {
      const response = await fetch(`/api/admin/orders/${order.displayId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? dictionary.errorLoading);
      }
      const nextStatus =
        action === "accept" ? "awaiting_food_payment" : "cancelled";
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, status: nextStatus } : item
        )
      );
      toast.success(dictionary.statusUpdatedToast);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.errorLoading
      );
      return false;
    } finally {
      setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
    }
  }, [dictionary.errorLoading, dictionary.statusUpdatedToast]);

  const handleRejectSubmit = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      setRejectSubmitting(true);
      const success = await updateOrderStatus(rejectTarget, "cancel", reason);
      setRejectSubmitting(false);
      if (success) {
        setRejectDialogOpen(false);
        setRejectTarget(null);
      }
    },
    [rejectTarget, updateOrderStatus]
  );

  const incomingOrders = useMemo(
    () => orders.filter((order) => order.status === "order_processing"),
    [orders]
  );

  const paymentOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status !== "order_processing"
      ),
    [orders]
  );

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }
    const channel = pusher.subscribe(ADMIN_ORDERS_CHANNEL);
    const seenEvents = seenEventsRef.current;

    const handleSubmitted = (payload: OrderSubmittedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      toast.success(dictionary.newOrderToast);

      // Build summary directly from payload (no API fetch needed)
      const summary: OrderAdminSummary = {
        id: payload.orderId,
        displayId: payload.displayId,
        displayDay: payload.displayDay,
        status: payload.status,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        totalAmount: payload.totalAmount,
        deliveryLabel: payload.deliveryLabel,
        createdAt: payload.at,
      };

      setOrders((prev) => [summary, ...prev]);
    };

    const handleStatusChanged = (payload: OrderStatusChangedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: payload.toStatus }
            : order
        )
      );
      toast.message(dictionary.statusUpdatedToast);
    };

    const handleClosed = (payload: OrderClosedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      // Update the order status in the list
      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: payload.finalStatus }
            : order
        )
      );
    };

    channel.bind(ORDER_SUBMITTED_EVENT, handleSubmitted);
    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);
    channel.bind(ORDER_CLOSED_EVENT, handleClosed);

    return () => {
      channel.unbind(ORDER_SUBMITTED_EVENT, handleSubmitted);
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);
      channel.unbind(ORDER_CLOSED_EVENT, handleClosed);
      pusher.unsubscribe(ADMIN_ORDERS_CHANNEL);
    };
  }, [dictionary.newOrderToast, dictionary.statusUpdatedToast]);

  const renderOrderCard = (order: OrderAdminSummary) => (
    <div
      key={order.id}
      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="text-sm font-medium text-slate-700">{order.customerName}</p>
        <p className="text-xs text-slate-500">
          {dictionary.createdLabel ?? "Created"}: {formatBangkokTimestamp(order.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-base font-semibold text-slate-900">
            {formatCurrency(order.totalAmount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {order.status === "order_processing" && (
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={actionState[order.id] === "saving"}
              onClick={() => void updateOrderStatus(order, "accept")}
            >
              {dictionary.accept}
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              order.status === "cancelled" ||
              order.status === "delivered" ||
              actionState[order.id] === "saving"
            }
            onClick={() => {
              setRejectTarget(order);
              setRejectDialogOpen(true);
            }}
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
  );

  const renderColumn = (
    title: string,
    emptyCopy: string,
    columnOrders: OrderAdminSummary[]
  ) => (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm font-medium text-slate-500">
          {columnOrders.length} orders
        </span>
      </div>
      {columnOrders.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          {emptyCopy}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {columnOrders.map((order) => renderOrderCard(order))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">{dictionary.listTitle}</h1>
        <p className="text-sm text-slate-500">
          {orders.length} total · {dictionary.todayListTitle ?? dictionary.listTitle}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {renderColumn(
          dictionary.incomingColumnTitle ?? "Incoming",
          dictionary.incomingColumnEmpty ?? dictionary.emptyState,
          incomingOrders
        )}
        {renderColumn(
          dictionary.paymentColumnTitle ?? "Paid & active orders",
          dictionary.paymentColumnEmpty ?? dictionary.emptyState,
          paymentOrders
        )}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dictionary={dictionary}
      />
      <RejectOrderDialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectTarget(null);
          }
        }}
        dictionary={dictionary}
        isSubmitting={rejectSubmitting}
        onSubmit={handleRejectSubmit}
      />
    </div>
  );
}
