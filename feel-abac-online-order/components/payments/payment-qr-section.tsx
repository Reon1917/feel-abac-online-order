"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import type { OrderRecord, OrderPaymentRecord } from "@/lib/orders/types";
import { ReceiptUploadButton } from "./receipt-upload-button";
import { RejectionBanner } from "./rejection-banner";

type PaymentDictionary = {
  howToPay: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  copyCode: string;
  copied: string;
  uploadReceipt: string;
  uploading: string;
  underReview: string;
  confirmed: string;
};

type Props = {
  order: OrderRecord;
  payment: OrderPaymentRecord | null;
  dictionary: PaymentDictionary;
  onReceiptUploaded?: () => void;
};

export function PaymentQrSection({
  order,
  payment,
  dictionary,
  onReceiptUploaded,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!payment?.qrPayload) return;

    try {
      await navigator.clipboard.writeText(payment.qrPayload);
      setCopied(true);
      toast.success(dictionary.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Show QR when awaiting payment
  if (
    order.status === "awaiting_food_payment" ||
    order.status === "awaiting_delivery_fee_payment"
  ) {
    const paymentType =
      order.status === "awaiting_food_payment" ? "food" : "delivery";

    if (!payment?.qrPayload) {
      return (
        <div className="flex items-center justify-center p-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading payment...
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Rejection banner if previously rejected */}
        <RejectionBanner payment={payment} />

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <QRCodeSVG
              value={payment.qrPayload}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Amount */}
        <p className="text-2xl font-bold text-center text-slate-900">
          ฿{payment.amount.toLocaleString()}
        </p>

        {/* Step-by-step instructions */}
        <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="font-semibold text-slate-700">{dictionary.howToPay}</p>
          <p>1. {dictionary.step1}</p>
          <p>2. {dictionary.step2}</p>
          <p>3. {dictionary.step3}</p>
          <p>4. {dictionary.step4}</p>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              {dictionary.copied}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              {dictionary.copyCode}
            </>
          )}
        </button>

        {/* Upload button */}
        <ReceiptUploadButton
          orderId={order.id}
          displayId={order.displayId}
          paymentType={paymentType}
          rejectionCount={payment.rejectionCount}
          dictionary={{
            uploadReceipt: dictionary.uploadReceipt,
            uploading: dictionary.uploading,
          }}
          onSuccess={onReceiptUploaded}
        />
      </div>
    );
  }

  // Show "under review" when waiting for admin
  if (
    order.status === "food_payment_review" ||
    order.status === "delivery_payment_review"
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl border border-amber-200">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 mb-2" />
        <p className="font-medium text-amber-800">{dictionary.underReview}</p>
      </div>
    );
  }

  // Show "confirmed" for kitchen and later statuses
  if (
    order.status === "order_in_kitchen" ||
    order.status === "order_out_for_delivery" ||
    order.status === "delivered"
  ) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
        <CheckCircle className="h-5 w-5 text-emerald-600" />
        <p className="font-medium text-emerald-800">{dictionary.confirmed}</p>
      </div>
    );
  }

  return null;
}

