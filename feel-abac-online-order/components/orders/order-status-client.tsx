'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import type orderDictionary from "@/dictionaries/en/order.json";
import { PaymentQrSection } from "@/components/payments/payment-qr-section";
import { RefundNoticeBanner } from "@/components/payments/refund-notice-banner";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_CLOSED_EVENT,
  PAYMENT_VERIFIED_EVENT,
  PAYMENT_REJECTED_EVENT,
  buildOrderChannelName,
  type OrderStatusChangedPayload,
  type OrderClosedPayload,
  type PaymentVerifiedPayload,
  type PaymentRejectedPayload,
} from "@/lib/orders/events";
import type { OrderRecord, OrderStatus } from "@/lib/orders/types";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { formatPromptPayPhoneForDisplay } from "@/lib/payments/promptpay";
import { toast } from "sonner";
import { statusLabel } from "@/lib/orders/format";

type OrderDictionary = typeof orderDictionary;

type Props = {
  initialOrder: OrderRecord;
  dictionary: OrderDictionary;
};

const STATUS_STEPS: Array<{ key: OrderStatus; labelKey: keyof OrderDictionary }> =
  [
    { key: "order_processing", labelKey: "statusProcessing" },
    { key: "order_in_kitchen", labelKey: "statusKitchen" },
    { key: "order_out_for_delivery", labelKey: "statusOutForDelivery" },
    { key: "delivered", labelKey: "statusDelivered" },
  ];

const PAYMENT_REVIEW_STATUSES = new Set<OrderStatus>([
  "food_payment_review",
  "delivery_payment_review",
]);

function resolveStep(status: OrderStatus) {
  switch (status) {
    case "order_processing":
    case "awaiting_food_payment":
    case "food_payment_review":
      return 0;
    case "order_in_kitchen":
      return 1;
    case "awaiting_delivery_fee_payment":
    case "delivery_payment_review":
    case "order_out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

const IS_DEV = process.env.NODE_ENV !== "production";

function formatCurrency(amount: number | null | undefined) {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return currencyFormatter.format(safe);
}

function formatTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export function OrderStatusClient({ initialOrder, dictionary }: Props) {
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cancelState, setCancelState] = useState<"idle" | "cancelling">("idle");
  
  // Track seen event IDs to prevent duplicate processing on reconnect
  const seenEventsRef = useRef<Set<string>>(new Set());

  const currentStep = useMemo(
    () => resolveStep(order.status),
    [order.status]
  );

  const foodPayment = useMemo(
    () => order.payments?.find((payment) => payment.type === "food") ?? null,
    [order.payments]
  );

  const deliveryPayment = useMemo(
    () => order.payments?.find((payment) => payment.type === "delivery") ?? null,
    [order.payments]
  );

  const isDeliveryPaymentStage =
    order.status === "awaiting_delivery_fee_payment" ||
    order.status === "delivery_payment_review";

  const activePayment = isDeliveryPaymentStage ? deliveryPayment : foodPayment;

  const foodPaymentAccountLabel = useMemo(() => {
    if (!foodPayment) return "";
    const phone = formatPromptPayPhoneForDisplay(foodPayment.payeePhoneNumber ?? "");
    const parts = [foodPayment.payeeName ?? null, phone || null].filter(Boolean);
    return parts.join(" · ");
  }, [foodPayment]);

  const canCancel = useMemo(() => {
    // Never allow cancel for closed/terminal states
    if (order.isClosed || order.status === "cancelled" || order.status === "delivered") {
      return false;
    }

    // Never allow cancel once payment is verified (order_in_kitchen or later)
    if (
      order.status === "order_in_kitchen" ||
      order.status === "awaiting_delivery_fee_payment" ||
      order.status === "delivery_payment_review" ||
      order.status === "order_out_for_delivery"
    ) {
      return false;
    }

    // Never allow cancel during payment review (receipt uploaded)
    if (order.status === "food_payment_review") {
      return false;
    }

    // Allow cancel for order_processing
    if (order.status === "order_processing") return true;

    // Allow cancel for awaiting_food_payment only if receipt NOT uploaded
    if (order.status === "awaiting_food_payment") {
      const receiptUploaded =
        Boolean(foodPayment?.receiptUploadedAt) ||
        (foodPayment?.status && foodPayment.status !== "pending" && foodPayment.status !== "rejected");
      return !receiptUploaded;
    }

    return false;
  }, [foodPayment?.receiptUploadedAt, foodPayment?.status, order.isClosed, order.status]);

  const refreshOrder = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.displayId}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.order) {
        setError(payload?.error ?? dictionary.orderNotFound);
        return;
      }
      setOrder(payload.order as OrderRecord);
    } catch {
      setError(dictionary.orderNotFound);
    } finally {
      setIsRefreshing(false);
    }
  }, [dictionary.orderNotFound, order.displayId]);

  useEffect(() => {
    // Do not subscribe to realtime updates for closed/terminal orders
    if (order.isClosed || order.status === "cancelled" || order.status === "delivered") {
      return;
    }

    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }
    const channelName = buildOrderChannelName(order.displayId);
    const channel = pusher.subscribe(channelName);
    const seenEvents = seenEventsRef.current;

    const handleStatusChange = (payload: OrderStatusChangedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      if (payload.orderId !== order.id) return;
      
      // Update order state - let UI show the new status
      setOrder((prev) => ({
        ...prev,
        status: payload.toStatus,
        updatedAt: payload.at,
        cancelledAt:
          payload.toStatus === "cancelled" ? payload.at : prev.cancelledAt,
        cancelReason: payload.reason ?? prev.cancelReason,
        isClosed: payload.toStatus === "cancelled" || payload.toStatus === "delivered",
      }));
      
      // Only refresh for non-terminal states
      if (payload.toStatus !== "cancelled" && payload.toStatus !== "delivered") {
        void refreshOrder();
      }
    };

    const handleClosed = (payload: OrderClosedPayload) => {
      // Deduplicate events by eventId
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      if (payload.orderId !== order.id) return;
      
      // Update order state with final status - let UI show the closed state
      setOrder((prev) => ({
        ...prev,
        status: payload.finalStatus,
        updatedAt: payload.at,
        isClosed: true,
        closedAt: payload.at,
        cancelledAt: payload.finalStatus === "cancelled" ? payload.at : prev.cancelledAt,
        cancelReason: payload.reason ?? prev.cancelReason,
      }));
      // Don't redirect - let user see the cancelled/delivered UI and click "Back to Menu"

      // Once the order is closed, we no longer need realtime updates
      pusher.unsubscribe(channelName);
    };

    const handlePaymentVerified = (payload: PaymentVerifiedPayload) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);
      if (payload.orderId !== order.id) return;

      toast.success("Food payment confirmed!");
      void refreshOrder();
    };

    const handlePaymentRejected = (payload: PaymentRejectedPayload) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);
      if (payload.orderId !== order.id) return;

      toast.error(
        payload.reason || "Receipt rejected. Please upload a valid receipt."
      );
      void refreshOrder();
    };

    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);
    channel.bind(ORDER_CLOSED_EVENT, handleClosed);
    channel.bind(PAYMENT_VERIFIED_EVENT, handlePaymentVerified);
    channel.bind(PAYMENT_REJECTED_EVENT, handlePaymentRejected);

    return () => {
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChange);
      channel.unbind(ORDER_CLOSED_EVENT, handleClosed);
      channel.unbind(PAYMENT_VERIFIED_EVENT, handlePaymentVerified);
      channel.unbind(PAYMENT_REJECTED_EVENT, handlePaymentRejected);
      pusher.unsubscribe(channelName);
    };
  }, [order.displayId, order.id, refreshOrder]);

  const handleCancelOrder = useCallback(async () => {
    setError(null);
    setCancelState("cancelling");
    try {
      const response = await fetch(`/api/orders/${order.displayId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? dictionary.statusUpdateFailed);
      }
      const cancelledAt = payload?.cancelledAt ?? new Date().toISOString();
      setOrder((prev) => ({
        ...prev,
        status: "cancelled",
        cancelledAt,
        cancelReason: payload?.reason ?? prev.cancelReason,
        isClosed: true,
        updatedAt: cancelledAt,
      }));
      toast.success(dictionary.statusUpdatedToast);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : dictionary.statusUpdateFailed
      );
      toast.error(
        err instanceof Error ? err.message : dictionary.statusUpdateFailed
      );
    } finally {
      setCancelState("idle");
    }
  }, [dictionary.statusUpdateFailed, dictionary.statusUpdatedToast, order.displayId]);

  const statusText = statusLabel(order.status, dictionary);
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const isClosed = cancelled || delivered;
  const showPaymentReviewWarning = PAYMENT_REVIEW_STATUSES.has(order.status);

  // Handle cleanup and navigation back to menu
  const handleBackToMenu = useCallback(() => {
    // Clear localStorage
    try {
      localStorage.removeItem("lastOrderDisplayId");
    } catch {
      // ignore
    }
    
    // Unsubscribe from Pusher channel
    const pusher = getPusherClient();
    if (pusher) {
      pusher.unsubscribe(buildOrderChannelName(order.displayId));
    }
    
    // Navigate to menu
    const locale = window.location.pathname.split("/")[1] as Locale;
    window.location.href = withLocalePath(locale, "/menu");
  }, [order.displayId]);

  useEffect(() => {
    try {
      if (isClosed) {
        localStorage.removeItem("lastOrderDisplayId");
      } else {
        localStorage.setItem("lastOrderDisplayId", order.displayId);
      }
    } catch {
      // ignore storage failures
    }
  }, [order.displayId, isClosed]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">
              {dictionary.orderIdLabel} {order.displayId}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {dictionary.pageTitle}
            </h1>
            <p className="text-sm text-slate-500">
              {dictionary.lastUpdated}: {formatTimestamp(order.updatedAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
                cancelled
                  ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
              )}
            >
              <span
                className={clsx(
                  "h-2.5 w-2.5 rounded-full",
                  cancelled ? "bg-red-500" : "bg-emerald-500"
                )}
              />
              {statusText}
            </span>
            {!isClosed &&
              order.status === "order_out_for_delivery" &&
              order.courierTrackingUrl && (
                <a
                  href={order.courierTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  {dictionary.trackDelivery ?? "Track delivery"}
                </a>
              )}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {dictionary.trackerLabel}
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center">
              {STATUS_STEPS.map((step, index) => {
                const reached = currentStep >= index;
                const passed = currentStep > index;
                const isLast = index === STATUS_STEPS.length - 1;
                return (
                  <div key={step.key} className="relative flex flex-1 items-center justify-center">
                    {index > 0 && (
                      <span
                        className={clsx(
                          "absolute left-0 top-1/2 h-0.5 w-1/2 -translate-y-1/2 rounded-full",
                          currentStep >= index
                            ? cancelled
                              ? "bg-red-400"
                              : "bg-emerald-400"
                            : "bg-slate-200"
                        )}
                      />
                    )}
                    {!isLast && (
                      <span
                        className={clsx(
                          "absolute right-0 top-1/2 h-0.5 w-1/2 -translate-y-1/2 rounded-full",
                          passed
                            ? cancelled
                              ? "bg-red-400"
                              : "bg-emerald-400"
                            : "bg-slate-200"
                        )}
                      />
                    )}
                    <div
                      className={clsx(
                        "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors sm:h-7 sm:w-7",
                        reached
                          ? cancelled
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white text-slate-400"
                      )}
                    >
                      {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium text-slate-600 sm:text-sm">
              {STATUS_STEPS.map((step) => {
                const label = dictionary[step.labelKey] as string;
                return (
                  <span key={step.key} className="block">
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
          {showPaymentReviewWarning && !isClosed && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">{dictionary.paymentReviewWarningTitle}</p>
              <p className="mt-1 text-sm text-amber-700">
                {dictionary.paymentReviewWarningBody}
              </p>
            </div>
          )}
          {cancelled && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{dictionary.cancelledCopy}</p>
              {order.cancelReason ? (
                <p className="mt-1 text-sm text-red-800">
                  <span className="font-semibold">
                    {dictionary.cancelReasonDisplayLabel ?? "Reason"}:
                  </span>{" "}
                  {order.cancelReason}
                </p>
              ) : null}
            </div>
          )}
          {delivered && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {dictionary.deliveredCopy ?? "Your order has been delivered. Thank you!"}
            </div>
          )}
          {isClosed && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleBackToMenu}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {dictionary.backToMenu ?? "Back to Menu"}
              </button>
            </div>
          )}
          {!isClosed && canCancel && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleCancelOrder()}
                disabled={cancelState === "cancelling"}
                className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelState === "cancelling"
                  ? dictionary.cancelling
                  : dictionary.cancelOrder}
              </button>
              <p className="text-xs text-slate-600">
                {dictionary.orderProcessingSubtitle}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Refund notice for cancelled orders with verified payment */}
      <RefundNoticeBanner order={order} />

      {/* Payment section - shows for awaiting payment and review statuses */}
      {(order.status === "awaiting_food_payment" ||
        order.status === "food_payment_review" ||
        order.status === "order_in_kitchen" ||
        order.status === "awaiting_delivery_fee_payment" ||
        order.status === "delivery_payment_review" ||
        order.status === "order_out_for_delivery" ||
        order.status === "delivered") && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isDeliveryPaymentStage
                  ? dictionary.deliveryPaymentSectionTitle ?? "Delivery fee payment"
                  : dictionary.paymentSectionTitle}
              </h2>
              <p className="text-sm text-slate-700">
                {isDeliveryPaymentStage
                  ? dictionary.deliveryPaymentSectionSubtitle ??
                    "Scan the PromptPay QR to pay your delivery fee."
                  : dictionary.paymentSectionSubtitle}
              </p>
            </div>
            {activePayment ? (
              <div className="text-right text-sm font-semibold text-slate-900">
                {(isDeliveryPaymentStage
                  ? dictionary.deliveryPaymentAmountLabel
                  : dictionary.paymentAmountLabel) ?? dictionary.paymentAmountLabel}
                : {formatCurrency(activePayment.amount)}
              </div>
            ) : null}
          </div>

          <PaymentQrSection
            order={order}
            payment={activePayment}
            dictionary={{
              howToPay: dictionary.howToPay ?? "How to pay:",
              step1: dictionary.step1 ?? "Screenshot this QR code",
              step2: dictionary.step2 ?? "Open your mobile banking app",
              step3: dictionary.step3 ?? "Scan QR & pay via PromptPay",
              step4: dictionary.step4 ?? "Upload your receipt below",
              uploadReceipt: dictionary.uploadReceipt ?? "I've Paid – Upload Receipt",
              uploading: dictionary.uploading ?? "Uploading...",
              underReview: isDeliveryPaymentStage
                ? dictionary.deliveryUnderReview ?? "Delivery fee under review"
                : dictionary.underReview ?? "Food Payment Under Review",
              confirmed: isDeliveryPaymentStage
                ? dictionary.deliveryConfirmed ?? "Delivery fee confirmed"
                : dictionary.confirmed ?? "Food Payment Confirmed",
            }}
            onReceiptUploaded={refreshOrder}
          />
        </section>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {dictionary.itemsLabel}
          </h2>
          <button
            type="button"
            onClick={() => void refreshOrder()}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            disabled={isRefreshing}
          >
            {isRefreshing ? "..." : dictionary.refresh}
          </button>
        </div>
        <div className="mt-4 divide-y divide-slate-200">
          {order.items.map((item) => (
            <div key={item.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {item.menuItemName}
                  </p>
                  {item.menuCode ? (
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {item.menuCode}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  ) : null}
                  <div className="mt-2 text-sm text-slate-600">
                    {item.choices.length === 0
                      ? dictionary.noChoices
                      : item.choices.map((choice) => (
                          <div key={choice.id} className="flex gap-2">
                            <span className="text-slate-500">•</span>
                            <span>
                              {choice.groupName}: {choice.optionName}
                            </span>
                          </div>
                        ))}
                  </div>
                </div>
                <div className="text-right text-sm text-slate-700">
                  <div className="font-semibold">
                    {dictionary.quantityLabel}: {item.quantity}
                  </div>
                  <div className="text-slate-600">
                    {formatCurrency(item.totalPrice)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span>{dictionary.subtotalLabel}</span>
            <span className="font-semibold">
              {formatCurrency(order.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{dictionary.deliveryFeeLabel}</span>
            <span className="font-semibold">
              {formatCurrency(order.deliveryFee)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-slate-900">
            <span>{dictionary.orderTotalLabel}</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dictionary.orderNoteLabel}
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {order.orderNote ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dictionary.deliveryNoteLabel}
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {order.deliveryNotes ?? "-"}
          </p>
        </div>
      </section>

      {/* Admin actions removed on user-facing page; admins manage via admin orders list */}
    </div>
  );
}
