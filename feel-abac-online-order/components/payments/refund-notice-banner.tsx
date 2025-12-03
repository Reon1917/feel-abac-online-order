"use client";

import { AlertTriangle } from "lucide-react";

import type { OrderRecord } from "@/lib/orders/types";

type RefundDictionary = {
  title?: string;
  subtitle?: string;
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

  const dict = { ...defaultDictionary, ...dictionary };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-800">{dict.title}</p>
          <p className="text-sm text-amber-700 mt-1">{dict.subtitle}</p>
          <ul className="text-sm text-amber-700 list-disc list-inside mt-2">
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

