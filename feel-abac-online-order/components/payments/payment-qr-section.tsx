"use client";

import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Loader2 } from "lucide-react";

import type { OrderRecord, OrderPaymentRecord } from "@/lib/orders/types";
import { ReceiptUploadButton } from "./receipt-upload-button";
import { RejectionBanner } from "./rejection-banner";
import { computeOrderTotals, ORDER_VAT_PERCENT_LABEL } from "@/lib/orders/totals";

function WavingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-bounce" />
    </div>
  );
}

type PaymentDictionary = {
  howToPay: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  uploadReceipt: string;
  uploading: string;
  underReview: string;
  confirmed: string;
  foodLabel?: string;
  vatLabel?: string;
  foodTotalLabel?: string;
  deliveryFeeLabel?: string;
  totalLabel?: string;
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
  // Show QR when awaiting payment
  if (order.status === "awaiting_payment") {

    if (!payment?.qrPayload) {
      return (
        <div className="flex items-center justify-center p-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading payment...
        </div>
      );
    }

    const totals = computeOrderTotals({
      foodSubtotal: order.subtotal,
      vatAmount: order.vatAmount,
      deliveryFee: order.deliveryFee,
      discountTotal: order.discountTotal,
    });
    const totalAmount = payment.amount;

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

        {/* Payment Breakdown */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">{dictionary.foodLabel ?? "Food"}</span>
            <span className="text-slate-900">฿{totals.foodSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              {dictionary.vatLabel ?? `VAT (${ORDER_VAT_PERCENT_LABEL})`}
            </span>
            <span className="text-slate-900">฿{totals.vatAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              {dictionary.foodTotalLabel ?? "Food Total"}
            </span>
            <span className="text-slate-900">฿{totals.foodTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{dictionary.deliveryFeeLabel ?? "Delivery Fee"}</span>
            <span className="text-slate-900">฿{totals.deliveryFee.toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
            <span className="text-slate-900">{dictionary.totalLabel ?? "Total"}</span>
            <span className="text-emerald-600 text-lg">฿{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="font-semibold text-slate-700">{dictionary.howToPay}</p>
          <p>1. {dictionary.step1}</p>
          <p>2. {dictionary.step2}</p>
          <p>3. {dictionary.step3}</p>
          <p>4. {dictionary.step4}</p>
        </div>

        {/* Upload button */}
        <ReceiptUploadButton
          orderId={order.id}
          displayId={order.displayId}
          paymentType="combined"
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
  if (order.status === "payment_review") {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl border border-amber-200">
        <div className="mb-3">
          <WavingDots />
        </div>
        <p className="font-medium text-amber-800">{dictionary.underReview}</p>
        <p className="text-xs text-amber-600 mt-1">We&apos;re verifying your payment slip</p>
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
