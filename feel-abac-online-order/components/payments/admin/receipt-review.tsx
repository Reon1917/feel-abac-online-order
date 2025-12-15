"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Loader2, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";

import type { OrderRecord, OrderPaymentRecord } from "@/lib/orders/types";

type Props = {
  order: OrderRecord;
  payment: OrderPaymentRecord;
  onVerified?: () => void;
  onRejected?: () => void;
};

export function ReceiptReviewSection({
  order,
  payment,
  onVerified,
  onRejected,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isVerifying, startVerify] = useTransition();
  const [isRejecting, startReject] = useTransition();

  // Only show for payment_review status
  if (order.status !== "payment_review") {
    return null;
  }

  if (!payment?.receiptUrl) {
    return null;
  }

  const handleVerify = () => {
    startVerify(async () => {
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/verify-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to verify payment");
        }

        toast.success("Payment verified");
        onVerified?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to verify payment"
        );
      }
    });
  };

  const handleReject = () => {
    startReject(async () => {
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/reject-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: rejectReason.trim() || undefined,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to reject payment");
        }

        toast.success("Receipt rejected");
        setShowRejectModal(false);
        setRejectReason("");
        onRejected?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reject payment"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Review Payment Receipt</h3>

      {/* Receipt thumbnail */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-2xl"
      >
        <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm group-hover:border-emerald-400 group-hover:shadow-md transition-all">
          <Image
            src={payment.receiptUrl}
            alt="Payment receipt"
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="bg-white/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <ZoomIn className="h-5 w-5 text-slate-700" />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">Click to view</p>
      </button>

      {/* Rejection count indicator */}
      {payment.rejectionCount > 0 && (
        <p className="text-xs text-slate-500">
          Previous rejections: {payment.rejectionCount}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying || isRejecting}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Confirm Payment
        </button>
        <button
          type="button"
          onClick={() => setShowRejectModal(true)}
          disabled={isVerifying || isRejecting}
          className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>

      {/* Full-size image modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          {/* Image container */}
          <div
            className="relative bg-white rounded-xl shadow-2xl overflow-hidden max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-800">Payment Receipt</p>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Image */}
            <div className="p-4 bg-slate-50">
              <Image
                src={payment.receiptUrl}
                alt="Payment receipt"
                width={500}
                height={650}
                className="object-contain w-full h-auto rounded-lg border border-slate-200"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-slate-900 mb-4">
              Reject Receipt
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason (optional)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white bg-red-600 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Reject Receipt"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

