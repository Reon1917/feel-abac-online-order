"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import type { OrderAdminSummary, OrderRecord } from "@/lib/orders/types";
import { formatBangkokTimestamp, formatDateHeader } from "@/lib/timezone";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";
import { OrderDetailModal } from "./order-detail-modal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

type Props = {
  initialOrders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
  days: string[];
  initialFilters: {
    day: string;
    status: string;
    refund: string;
    query: string;
    min: string;
    max: string;
  };
};

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export function ArchivedOrdersClient({
  initialOrders,
  dictionary,
  days,
  initialFilters,
}: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [refundState, setRefundState] = useState<Record<string, "idle" | "saving">>({});
  const [filters, setFilters] = useState(initialFilters);

  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const dayOptions = useMemo(
    () =>
      days.map((day) => ({
        value: day,
        label: formatDateHeader(day),
      })),
    [days]
  );

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    const trimmedQuery = filters.query.trim();
    const minValue = filters.min.trim();
    const maxValue = filters.max.trim();

    if (filters.day && filters.day !== "all") {
      params.set("day", filters.day);
    } else {
      params.set("day", "all");
    }

    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }

    if (filters.refund && filters.refund !== "all") {
      params.set("refund", filters.refund);
    }

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    if (minValue) {
      params.set("min", minValue);
    }

    if (maxValue) {
      params.set("max", maxValue);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [filters, pathname, router, startTransition]);

  const resetFilters = useCallback(() => {
    setFilters({
      day: "all",
      status: "all",
      refund: "all",
      query: "",
      min: "",
      max: "",
    });
    startTransition(() => {
      router.replace(`${pathname}?day=all`);
    });
  }, [pathname, router, startTransition]);

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

  const handleMarkRefundPaid = useCallback(
    async (order: OrderAdminSummary) => {
      setRefundState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refund_paid" }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  refundStatus: payload?.refundStatus ?? "paid",
                }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
      } finally {
        setRefundState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  const handleMarkRefundRequested = useCallback(
    async (order: OrderAdminSummary) => {
      setRefundState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refund_requested" }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  refundStatus: payload?.refundStatus ?? "requested",
                }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
      } finally {
        setRefundState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  const columns = useMemo<ColumnDef<OrderAdminSummary>[]>(
    () => [
      {
        accessorKey: "displayId",
        header: dictionary.orderIdLabel ?? "Order",
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            #{row.original.displayId}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: dictionary.statusLabel ?? "Status",
        cell: ({ row }) => (
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              statusBadgeClass(row.original.status)
            )}
          >
            {statusLabel(row.original.status, dictionary, {
              refundStatus: row.original.refundStatus,
            })}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: dictionary.totalLabel ?? "Total",
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            {formatCurrency(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: dictionary.createdLabel ?? "Created",
        cell: ({ row }) => (
          <span className="text-sm text-slate-500">
            {formatBangkokTimestamp(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: dictionary.actionsLabel ?? "Actions",
        cell: ({ row }) => {
          const order = row.original;
          const isViewing = loadingOrderId === order.id;
          const refundSaving = refundState[order.id] === "saving";
          // Only show refund options if there was a verified payment
          const canMarkRefundPaid =
            order.status === "cancelled" && 
            order.hasVerifiedPayment && 
            order.refundStatus === "requested";
          const canMarkRefundRequested =
            order.status === "cancelled" && 
            order.hasVerifiedPayment && 
            !order.refundStatus;
          const noRefundNeeded = 
            order.status === "cancelled" && !order.hasVerifiedPayment;

          return (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isViewing}
                onClick={() => void handleViewOrder(order)}
              >
                {isViewing ? "..." : dictionary.viewOrder}
              </Button>
              {noRefundNeeded && (
                <span className="text-xs text-slate-500">
                  {dictionary.noRefundNeeded ?? "No refund needed"}
                </span>
              )}
              {canMarkRefundPaid && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={refundSaving}
                  onClick={() => void handleMarkRefundPaid(order)}
                >
                  {dictionary.actionMarkRefundPaid ?? "Mark refund paid"}
                </Button>
              )}
              {canMarkRefundRequested && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refundSaving}
                  onClick={() => void handleMarkRefundRequested(order)}
                >
                  {dictionary.actionMarkRefundRequested ?? "Mark refund requested"}
                </Button>
              )}
              {order.refundStatus === "paid" && (
                <span className="text-xs font-semibold text-emerald-600">
                  {dictionary.statusRefundPaid ?? "Refund paid"}
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [
      dictionary,
      handleMarkRefundPaid,
      handleMarkRefundRequested,
      handleViewOrder,
      loadingOrderId,
      refundState,
    ]
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          {dictionary.noArchivedOrders ?? "No past orders found"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.filterSearchLabel ?? "Search"}
            </label>
            <input
              type="text"
              value={filters.query}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, query: event.target.value }))
              }
              placeholder={dictionary.filterSearchPlaceholder ?? "Order ID or customer"}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.archivedDayLabel ?? "Day"}
            </label>
            <Select
              value={filters.day}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, day: value }))
              }
              disabled={isPending}
            >
              <SelectTrigger className="mt-1 w-48">
                <SelectValue
                  placeholder={dictionary.archivedDayPlaceholder ?? "Select a day"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {dictionary.archivedDayAll ?? "Last 7 days"}
                </SelectItem>
                {dayOptions.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.filterStatusLabel ?? "Status"}
            </label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value }))
              }
              disabled={isPending}
            >
              <SelectTrigger className="mt-1 w-44">
                <SelectValue placeholder={dictionary.filterStatusPlaceholder ?? "All statuses"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {dictionary.filterStatusAll ?? "All statuses"}
                </SelectItem>
                <SelectItem value="order_processing">
                  {dictionary.statusProcessing ?? "Received"}
                </SelectItem>
                <SelectItem value="awaiting_payment">
                  {dictionary.statusAwaitingPayment ?? "Awaiting Payment"}
                </SelectItem>
                <SelectItem value="payment_review">
                  {dictionary.statusPaymentReview ?? "Verifying Payment"}
                </SelectItem>
                <SelectItem value="order_in_kitchen">
                  {dictionary.statusKitchen ?? "Paid"}
                </SelectItem>
                <SelectItem value="order_out_for_delivery">
                  {dictionary.statusOutForDelivery ?? "With Delivery"}
                </SelectItem>
                <SelectItem value="delivered">
                  {dictionary.statusDelivered ?? "Delivered"}
                </SelectItem>
                <SelectItem value="closed">
                  {dictionary.statusClosed ?? "Closed"}
                </SelectItem>
                <SelectItem value="cancelled">
                  {dictionary.statusCancelled ?? "Rejected"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.filterRefundLabel ?? "Refund"}
            </label>
            <Select
              value={filters.refund}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, refund: value }))
              }
              disabled={isPending}
            >
              <SelectTrigger className="mt-1 w-40">
                <SelectValue placeholder={dictionary.filterRefundPlaceholder ?? "All"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {dictionary.filterRefundAll ?? "All"}
                </SelectItem>
                <SelectItem value="requested">
                  {dictionary.statusRefundRequested ?? "Order cancelled after payment"}
                </SelectItem>
                <SelectItem value="paid">
                  {dictionary.statusRefundPaid ?? "Refund paid"}
                </SelectItem>
                <SelectItem value="none">
                  {dictionary.filterRefundNone ?? "Not marked"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.filterMinTotalLabel ?? "Min total"}
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.min}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, min: event.target.value }))
              }
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.filterMaxTotalLabel ?? "Max total"}
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.max}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, max: event.target.value }))
              }
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              {dictionary.filterReset ?? "Reset"}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {dictionary.filterApply ?? "Apply filters"}
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-slate-500"
                >
                  {dictionary.archivedDayEmpty ?? "No orders for this day"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dictionary={dictionary}
      />
    </div>
  );
}
