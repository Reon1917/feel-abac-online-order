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
import type { OrderAdminSummary, OrderRecord, OrderStatus } from "@/lib/orders/types";
import { formatBangkokTimestamp } from "@/lib/timezone";
import { OrderDetailModal } from "./order-detail-modal";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  initialOrders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
};

const INCOMING_STATUSES = new Set<OrderStatus>([
  "order_processing",
  "awaiting_food_payment",
]);

const SLIP_REVIEW_STATUSES = new Set<OrderStatus>(["food_payment_review"]);

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

type SectionProps = {
  title: string;
  subtitle?: string;
  emptyMessage: string;
  orders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
  actionState: Record<string, "idle" | "saving">;
  loadingOrderId: string | null;
  onAccept: (order: OrderAdminSummary) => void;
  onCancel: (order: OrderAdminSummary) => void;
  onView: (order: OrderAdminSummary) => void;
  showActions?: boolean;
};

function OrderListSection({
  title,
  subtitle,
  emptyMessage,
  orders,
  dictionary,
  actionState,
  loadingOrderId,
  onAccept,
  onCancel,
  onView,
  showActions = true,
}: SectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <span className="text-sm font-medium text-slate-500">{orders.length} orders</span>
      </div>
      {orders.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="text-right">
                  <p className="text-base font-semibold text-slate-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBangkokTimestamp(order.createdAt)}
                  </p>
                </div>
                {showActions && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        order.status !== "order_processing" ||
                        actionState[order.id] === "saving"
                      }
                      onClick={() => onAccept(order)}
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
                      onClick={() => onCancel(order)}
                    >
                      {dictionary.cancel}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onView(order)}
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
    </section>
  );
}

export function OrderListClient({ initialOrders, dictionary }: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving">>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [cancelDialogOrder, setCancelDialogOrder] = useState<OrderAdminSummary | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedQuickReason, setSelectedQuickReason] = useState<string | null>(null);
    const cancelReasonPresets = useMemo(() => {
      const options = [
        dictionary.cancelReasonPresetOutOfStock ?? "We're sold out of this menu item today.",
        dictionary.cancelReasonPresetKitchenClosed ?? "Our kitchen closed early today.",
        dictionary.cancelReasonPresetDeliveryIssue ?? "We can't deliver to this location right now.",
        dictionary.cancelReasonPresetDuplicate ?? "This looks like a duplicate order.",
      ];
      return options.filter(Boolean);
    }, [dictionary.cancelReasonPresetDeliveryIssue, dictionary.cancelReasonPresetDuplicate, dictionary.cancelReasonPresetKitchenClosed, dictionary.cancelReasonPresetOutOfStock]);
  
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

  const updateOrderStatus = async (
    order: OrderAdminSummary,
    action: "accept" | "cancel",
    reason?: string
  ) => {
    setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
    let success = false;
    try {
      const requestBody: Record<string, string> = { action };
      if (reason) {
        requestBody.reason = reason;
      }
      const response = await fetch(`/api/admin/orders/${order.displayId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update order");
      }
      const nextStatus =
        action === "accept" ? "awaiting_food_payment" : "cancelled";
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, status: nextStatus } : item
        )
      );
      toast.success(dictionary.statusUpdatedToast);
      success = true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.errorLoading
      );
    } finally {
      setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
    }
    return success;
  };

  const requestCancelOrder = (order: OrderAdminSummary) => {
    setCancelDialogOrder(order);
    setCancelReason("");
    setSelectedQuickReason(null);
  };

  const handleCancelDialogClose = () => {
    setCancelDialogOrder(null);
    setCancelReason("");
    setSelectedQuickReason(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelDialogOrder) return;
    const trimmed = cancelReason.trim();
    const finalReason = trimmed || selectedQuickReason?.trim() || "";
    if (!finalReason) {
      toast.error(
        dictionary.cancelReasonRequired ??
          "Please enter a reason to reject this order."
      );
      return;
    }
    const success = await updateOrderStatus(
      cancelDialogOrder,
      "cancel",
      finalReason
    );
    if (success) {
      handleCancelDialogClose();
    }
  };

  const isCancelDialogOpen = Boolean(cancelDialogOrder);
  const isCancelDialogSaving = cancelDialogOrder
    ? actionState[cancelDialogOrder.id] === "saving"
    : false;

  const { incomingOrders, slipOrders, otherOrders } = useMemo(() => {
    const incoming = [] as OrderAdminSummary[];
    const slip = [] as OrderAdminSummary[];
    const other = [] as OrderAdminSummary[];

    for (const order of orders) {
      if (INCOMING_STATUSES.has(order.status)) {
        incoming.push(order);
      } else if (SLIP_REVIEW_STATUSES.has(order.status)) {
        slip.push(order);
      } else {
        other.push(order);
      }
    }

    return { incomingOrders: incoming, slipOrders: slip, otherOrders: other };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <OrderListSection
          title={dictionary.incomingSectionTitle ?? dictionary.listTitle}
          subtitle={dictionary.incomingSectionSubtitle ?? dictionary.todayListTitle}
          emptyMessage={dictionary.incomingEmptyState ?? dictionary.emptyState}
          orders={incomingOrders}
          dictionary={dictionary}
          actionState={actionState}
          loadingOrderId={loadingOrderId}
          onAccept={(order) => void updateOrderStatus(order, "accept")}
          onCancel={requestCancelOrder}
          onView={(order) => void handleViewOrder(order)}
        />
        <OrderListSection
          title={dictionary.slipSectionTitle ?? "Paid orders (slip uploaded)"}
          subtitle={dictionary.slipSectionSubtitle ?? "Receipts waiting for verification"}
          emptyMessage={dictionary.slipEmptyState ?? dictionary.emptyState}
          orders={slipOrders}
          dictionary={dictionary}
          actionState={actionState}
          loadingOrderId={loadingOrderId}
          onAccept={(order) => void updateOrderStatus(order, "accept")}
          onCancel={requestCancelOrder}
          onView={(order) => void handleViewOrder(order)}
        />
      </div>
      <OrderListSection
        title={dictionary.otherSectionTitle ?? dictionary.listTitle}
        subtitle={dictionary.otherSectionSubtitle ?? "Kitchen, delivery, or completed"}
        emptyMessage={dictionary.otherEmptyState ?? dictionary.emptyState}
        orders={otherOrders}
        dictionary={dictionary}
        actionState={actionState}
        loadingOrderId={loadingOrderId}
        onAccept={(order) => void updateOrderStatus(order, "accept")}
        onCancel={(order) => void updateOrderStatus(order, "cancel")}
        onView={(order) => void handleViewOrder(order)}
        showActions={false}
      />

      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dictionary={dictionary}
        onStatusUpdated={handleStatusUpdated}
      />

      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(next) => {
          if (!next && !isCancelDialogSaving) {
            handleCancelDialogClose();
          }
        }}
      >
        <DialogContent showCloseButton={!isCancelDialogSaving}>
          <DialogHeader>
            <DialogTitle>
              {dictionary.cancelDialogTitle ?? "Reject order"}
            </DialogTitle>
            <DialogDescription>
              {dictionary.cancelDialogDescription ??
                "Share a short reason. Diners see this instantly."}
            </DialogDescription>
          </DialogHeader>
          {cancelDialogOrder && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                {dictionary.orderIdLabel} {cancelDialogOrder.displayId}
              </p>
              <p>
                {dictionary.customerLabel}: {cancelDialogOrder.customerName}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.cancelReasonPresetsLabel ?? "Quick reasons"}
            </p>
            <div className="flex flex-wrap gap-2">
              {cancelReasonPresets.map((label) => (
                <button
                  type="button"
                  key={label}
                    className={clsx(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      selectedQuickReason === label
                        ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                    )}
                    onClick={() =>
                      setSelectedQuickReason((prev) =>
                        prev === label ? null : label
                      )
                    }
                  disabled={isCancelDialogSaving}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              {dictionary.cancelReasonPresetHint ??
                "Select a quick reason or type your own, then press reject."}
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="admin-cancel-reason"
              className="text-sm font-semibold text-slate-800"
            >
              {dictionary.cancelReasonLabel ?? "Reason"}
            </label>
            <Textarea
              id="admin-cancel-reason"
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={
                dictionary.cancelReasonPlaceholder ??
                "Let the diner know why you're cancelling"
              }
              disabled={isCancelDialogSaving}
            />
            <p className="text-xs text-slate-500">
              {dictionary.cancelReasonHelper ??
                "Customers will see this message on their status page."}
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={handleCancelDialogClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCancelDialogSaving}
            >
              {dictionary.cancelDialogDismiss ?? "Keep order"}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmCancel()}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCancelDialogSaving}
            >
              {isCancelDialogSaving
                ? "..."
                : dictionary.cancelDialogConfirm ?? "Send reason & reject"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
