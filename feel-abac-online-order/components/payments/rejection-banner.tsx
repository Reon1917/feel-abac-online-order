"use client";

import { AlertCircle, XCircle } from "lucide-react";

import type { OrderPaymentRecord } from "@/lib/orders/types";
import { MAX_REJECTION_COUNT } from "@/config/payments";

type Props = {
  payment: OrderPaymentRecord;
};

export function RejectionBanner({ payment }: Props) {
  // Only show for rejected payments
  if (payment.status !== "rejected") return null;

  const retriesLeft = MAX_REJECTION_COUNT - (payment.rejectionCount ?? 0);
  const isBlocked = retriesLeft <= 0;

  if (isBlocked) {
    return (
      <div className="bg-slate-100 border border-slate-300 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-800">
              Maximum Attempts Reached
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Please contact support for assistance with your order.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-700">Receipt Rejected</p>
          {payment.rejectedReason && (
            <p className="text-sm text-red-600 mt-1">
              {payment.rejectedReason}
            </p>
          )}
          <p className="text-sm text-red-600 mt-2">
            Please upload a valid receipt. ({retriesLeft} attempts remaining)
          </p>
        </div>
      </div>
    </div>
  );
}

