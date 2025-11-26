"use client";

import { useCallback, useState, useMemo } from "react";
import clsx from "clsx";
import { toast } from "sonner";

import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import type { OrderAdminSummary, OrderRecord, OrderStatus } from "@/lib/orders/types";
import { formatDateHeader, formatBangkokTimestamp } from "@/lib/timezone";
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
  if (
    status === "order_in_kitchen" ||
    status === "order_out_for_delivery" ||
    status === "delivered"
  ) {
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

type GroupedOrders = {
  displayDay: string;
  orders: OrderAdminSummary[];
}[];

function groupOrdersByDay(orders: OrderAdminSummary[]): GroupedOrders {
  const groups = new Map<string, OrderAdminSummary[]>();
  for (const order of orders) {
    const day = order.displayDay || "unknown";
    const existing = groups.get(day) ?? [];
    existing.push(order);
    groups.set(day, existing);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([displayDay, orders]) => ({ displayDay, orders }));
}

export function ArchivedOrdersClient({ initialOrders, dictionary }: Props) {
  const [orders] = useState<OrderAdminSummary[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const groupedOrders = useMemo(() => groupOrdersByDay(orders), [orders]);

  const handleViewOrder = useCallback(
    async (order: OrderAdminSummary) => {
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
    },
    [dictionary.errorLoading]
  );

  const handleStatusUpdated = useCallback(() => {
    // Archived orders are read-only, so we just close the modal
  }, []);

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          {dictionary.noArchivedOrders ?? "No past orders found"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedOrders.map((group) => (
        <div
          key={group.displayDay}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {formatDateHeader(group.displayDay)}
            </h3>
            <p className="text-xs text-slate-500">
              {group.orders.length} {group.orders.length === 1 ? "order" : "orders"}
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {group.orders.map((order) => (
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
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
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
        </div>
      ))}

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

