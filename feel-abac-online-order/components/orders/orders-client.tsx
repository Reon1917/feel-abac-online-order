"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";
import type { OrderStatus } from "@/lib/orders/types";
import type { UserOrderSummary } from "@/lib/orders/queries";

type OrdersClientProps = {
  orders: UserOrderSummary[];
  locale: Locale;
  statusLabels: Record<string, string>;
  tabLabels: {
    ongoing: string;
    completed: string;
    cancelled: string;
  };
  emptyState: {
    noOrders: string;
    noOrdersDescription: string;
    browseMenu: string;
  };
};

type TabType = "ongoing" | "completed" | "cancelled";

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  order_processing: { bg: "bg-amber-100", text: "text-amber-800" },
  awaiting_food_payment: { bg: "bg-yellow-100", text: "text-yellow-800" },
  food_payment_review: { bg: "bg-blue-100", text: "text-blue-800" },
  order_in_kitchen: { bg: "bg-indigo-100", text: "text-indigo-800" },
  awaiting_delivery_fee_payment: { bg: "bg-orange-100", text: "text-orange-800" },
  delivery_payment_review: { bg: "bg-blue-100", text: "text-blue-800" },
  order_out_for_delivery: { bg: "bg-purple-100", text: "text-purple-800" },
  delivered: { bg: "bg-emerald-100", text: "text-emerald-800" },
  cancelled: { bg: "bg-red-100", text: "text-red-800" },
};

const ONGOING_STATUSES: OrderStatus[] = [
  "order_processing",
  "awaiting_food_payment",
  "food_payment_review",
  "order_in_kitchen",
  "awaiting_delivery_fee_payment",
  "delivery_payment_review",
  "order_out_for_delivery",
];

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoString: string, locale: Locale) {
  const date = new Date(isoString);
  return date.toLocaleDateString(locale === "my" ? "my-MM" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderCard({
  order,
  locale,
  labels,
}: {
  order: UserOrderSummary;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const statusColor = STATUS_COLORS[order.status] ?? STATUS_COLORS.order_processing;

  return (
    <Link
      href={withLocalePath(locale, `/orders/${order.displayId}`)}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100">
        <Package className="h-6 w-6 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">#{order.displayId}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
          >
            {labels[order.status] ?? order.status}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"} • ฿
          {formatPrice(order.totalAmount)}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {formatDate(order.createdAt, locale)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
    </Link>
  );
}

function EmptyTabState({
  locale,
  emptyState,
}: {
  locale: Locale;
  emptyState: OrdersClientProps["emptyState"];
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Package className="mx-auto h-12 w-12 text-slate-300" />
      <h2 className="mt-4 text-lg font-semibold text-slate-700">
        {emptyState.noOrders}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {emptyState.noOrdersDescription}
      </p>
      <Link
        href={withLocalePath(locale, "/menu")}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-700"
      >
        {emptyState.browseMenu}
      </Link>
    </div>
  );
}

export function OrdersClient({
  orders,
  locale,
  statusLabels,
  tabLabels,
  emptyState,
}: OrdersClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ongoing");

  // Categorize orders
  const ongoingOrders = orders.filter((o) =>
    ONGOING_STATUSES.includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === "delivered");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "ongoing", label: tabLabels.ongoing, count: ongoingOrders.length },
    { id: "completed", label: tabLabels.completed, count: completedOrders.length },
    { id: "cancelled", label: tabLabels.cancelled, count: cancelledOrders.length },
  ];

  const currentOrders =
    activeTab === "ongoing"
      ? ongoingOrders
      : activeTab === "completed"
        ? completedOrders
        : cancelledOrders;

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={clsx(
                  "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  activeTab === tab.id
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {currentOrders.length === 0 ? (
        <EmptyTabState locale={locale} emptyState={emptyState} />
      ) : (
        <div className="flex flex-col gap-3">
          {currentOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              locale={locale}
              labels={statusLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
