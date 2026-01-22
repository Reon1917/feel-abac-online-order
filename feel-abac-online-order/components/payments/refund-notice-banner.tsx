"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

import type { OrderRecord } from "@/lib/orders/types";

type RefundDictionary = {
  title?: string;
  subtitle?: string;
  paidTitle?: string;
  paidSubtitle?: string;
  orderNumberLabel?: string;
  receiptLabel?: string;
};

type Props = {
  order: OrderRecord;
  dictionary?: RefundDictionary;
};

const defaultDictionary: Required<RefundDictionary> = {
  title: "Order Cancelled - Refund Pending",
  subtitle: "You will be contacted for a refund. Please keep note of:",
  paidTitle: "Refund Paid",
  paidSubtitle: "Your refund has been processed. Please keep note of:",
  orderNumberLabel: "Order number",
  receiptLabel: "Your payment receipt",
};

export function RefundNoticeBanner({ order, dictionary }: Props) {
  // Only show for cancelled orders with verified payment
  if (order.status !== "cancelled") return null;

  const hasVerifiedPayment = order.payments.some(
    (p) => p.status === "verified"
  );
  if (!hasVerifiedPayment) return null;
  if (order.refundType === "none") return null;

  const isRefundPaid = order.refundStatus === "paid";
  const dict = { ...defaultDictionary, ...dictionary };
  const title = isRefundPaid ? dict.paidTitle : dict.title;
  const subtitle = isRefundPaid ? dict.paidSubtitle : dict.subtitle;
  const Icon = isRefundPaid ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={clsx(
        "rounded-xl border p-4 space-y-2",
        isRefundPaid
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={clsx(
            "h-5 w-5 flex-shrink-0 mt-0.5",
            isRefundPaid ? "text-emerald-600" : "text-amber-600"
          )}
        />
        <div>
          <p
            className={clsx(
              "font-semibold",
              isRefundPaid ? "text-emerald-800" : "text-amber-800"
            )}
          >
            {title}
          </p>
          <p
            className={clsx(
              "text-sm mt-1",
              isRefundPaid ? "text-emerald-700" : "text-amber-700"
            )}
          >
            {subtitle}
          </p>
          <ul
            className={clsx(
              "text-sm list-disc list-inside mt-2",
              isRefundPaid ? "text-emerald-700" : "text-amber-700"
            )}
          >
            <li>
              {dict.orderNumberLabel}: <strong>{order.displayId}</strong>
            </li>
            <li>{dict.receiptLabel}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
