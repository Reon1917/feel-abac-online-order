import type { AdminReportOrder } from "@/lib/orders/queries";
import type { RefundType } from "@/lib/orders/types";

export type ReportBreakdown = {
  food: number;
  tax: number;
  delivery: number;
  total: number;
};

export type DailySalesSummary = {
  displayDay: string;
  orderCount: number;
  paidOrderCount: number;
  grossSales: number;
  paidRefunds: number;
  pendingRefunds: number;
  netSales: number;
};

export type AdminSalesAnalytics = {
  orderCount: number;
  paidOrderCount: number;
  cancelledOrderCount: number;
  openRefundCount: number;
  grossSales: number;
  paidRefunds: number;
  pendingRefunds: number;
  netSales: number;
  collectedBreakdown: ReportBreakdown;
  paidRefundBreakdown: ReportBreakdown;
  pendingRefundBreakdown: ReportBreakdown;
  netBreakdown: ReportBreakdown;
  byDay: DailySalesSummary[];
};

function zeroBreakdown(): ReportBreakdown {
  return {
    food: 0,
    tax: 0,
    delivery: 0,
    total: 0,
  };
}

function buildBreakdown(food: number, tax: number, delivery: number): ReportBreakdown {
  return {
    food,
    tax,
    delivery,
    total: food + tax + delivery,
  };
}

function addBreakdown(target: ReportBreakdown, amount: ReportBreakdown) {
  target.food += amount.food;
  target.tax += amount.tax;
  target.delivery += amount.delivery;
  target.total += amount.total;
}

function resolveRefundBaseComponents(order: AdminReportOrder, refundType: RefundType | null) {
  const food = Math.max(0, order.subtotal);
  const tax = Math.max(0, order.vatAmount);
  const delivery = Math.max(0, order.deliveryFee);

  if (refundType === "delivery_fee_only") {
    return buildBreakdown(0, 0, delivery);
  }
  if (refundType === "food_only") {
    return buildBreakdown(food, tax, 0);
  }
  if (refundType === "full") {
    return buildBreakdown(food, tax, delivery);
  }
  return zeroBreakdown();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function allocateRefundComponents(order: AdminReportOrder): ReportBreakdown {
  const base = resolveRefundBaseComponents(order, order.refundType ?? null);
  if (base.total <= 0) {
    return zeroBreakdown();
  }

  const explicitAmount =
    typeof order.refundAmount === "number" && Number.isFinite(order.refundAmount)
      ? Math.max(0, order.refundAmount)
      : null;
  const effectiveAmount = explicitAmount ?? base.total;

  if (effectiveAmount <= 0) {
    return zeroBreakdown();
  }

  const ratio = base.total > 0 ? Math.min(1, effectiveAmount / base.total) : 0;
  return buildBreakdown(
    round2(base.food * ratio),
    round2(base.tax * ratio),
    round2(base.delivery * ratio)
  );
}

export function buildAdminSalesAnalytics(orders: AdminReportOrder[]): AdminSalesAnalytics {
  const collectedBreakdown = zeroBreakdown();
  const paidRefundBreakdown = zeroBreakdown();
  const pendingRefundBreakdown = zeroBreakdown();

  const byDayMap = new Map<string, DailySalesSummary>();

  let paidOrderCount = 0;
  let cancelledOrderCount = 0;
  let openRefundCount = 0;

  for (const order of orders) {
    const day = order.displayDay;
    const dayBucket =
      byDayMap.get(day) ??
      {
        displayDay: day,
        orderCount: 0,
        paidOrderCount: 0,
        grossSales: 0,
        paidRefunds: 0,
        pendingRefunds: 0,
        netSales: 0,
      };

    dayBucket.orderCount += 1;

    if (order.status === "cancelled") {
      cancelledOrderCount += 1;
    }

    if (order.hasVerifiedPayment) {
      paidOrderCount += 1;
      dayBucket.paidOrderCount += 1;

      const collected = buildBreakdown(
        Math.max(0, order.subtotal),
        Math.max(0, order.vatAmount),
        Math.max(0, order.deliveryFee)
      );
      addBreakdown(collectedBreakdown, collected);
      dayBucket.grossSales += collected.total;
    }

    const hasRefund = order.refundType != null && order.refundType !== "none";
    if (hasRefund && order.refundStatus === "requested") {
      openRefundCount += 1;
    }

    if (hasRefund && (order.refundStatus === "requested" || order.refundStatus === "paid")) {
      const refundAllocation = allocateRefundComponents(order);
      if (refundAllocation.total > 0) {
        if (order.refundStatus === "paid") {
          addBreakdown(paidRefundBreakdown, refundAllocation);
          dayBucket.paidRefunds += refundAllocation.total;
        } else {
          addBreakdown(pendingRefundBreakdown, refundAllocation);
          dayBucket.pendingRefunds += refundAllocation.total;
        }
      }
    }

    dayBucket.netSales = dayBucket.grossSales - dayBucket.paidRefunds;
    byDayMap.set(day, dayBucket);
  }

  const netBreakdown = buildBreakdown(
    collectedBreakdown.food - paidRefundBreakdown.food,
    collectedBreakdown.tax - paidRefundBreakdown.tax,
    collectedBreakdown.delivery - paidRefundBreakdown.delivery
  );

  const byDay = Array.from(byDayMap.values()).sort((a, b) =>
    b.displayDay.localeCompare(a.displayDay)
  );

  return {
    orderCount: orders.length,
    paidOrderCount,
    cancelledOrderCount,
    openRefundCount,
    grossSales: collectedBreakdown.total,
    paidRefunds: paidRefundBreakdown.total,
    pendingRefunds: pendingRefundBreakdown.total,
    netSales: netBreakdown.total,
    collectedBreakdown,
    paidRefundBreakdown,
    pendingRefundBreakdown,
    netBreakdown,
    byDay,
  };
}
