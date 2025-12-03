"use client";

import type { OrderPaymentRecord } from "@/lib/orders/types";

type Props = {
  payment: OrderPaymentRecord | null | undefined;
};

export function PaymentBadge({ payment }: Props) {
  if (!payment) return null;

  if (payment.status === "receipt_uploaded") {
    return (
      <span className="inline-flex items-center bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
        Receipt Uploaded
      </span>
    );
  }

  if (payment.status === "verified") {
    return (
      <span className="inline-flex items-center bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-semibold">
        Payment Verified ✓
      </span>
    );
  }

  if (payment.status === "rejected") {
    return (
      <span className="inline-flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">
        Receipt Rejected
      </span>
    );
  }

  if (payment.status === "pending") {
    return (
      <span className="inline-flex items-center bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-semibold">
        Awaiting Payment
      </span>
    );
  }

  return null;
}

