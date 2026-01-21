'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import Image from "next/image";
import {
  Package,
  CreditCard,
  ChefHat,
  Truck,
  CheckCircle2,
  RotateCcw,
  Archive,
  Eye,
  X,
  ImageIcon,
} from "lucide-react";

import type adminOrdersDictionary from "@/dictionaries/en/admin-orders.json";
import { getPusherClient } from "@/lib/pusher/client";
import {
  ADMIN_ORDERS_CHANNEL,
  ORDER_STATUS_CHANGED_EVENT,
  ORDER_SUBMITTED_EVENT,
  ORDER_CLOSED_EVENT,
  PAYMENT_RECEIPT_UPLOADED_EVENT,
  type OrderStatusChangedPayload,
  type OrderSubmittedPayload,
  type OrderClosedPayload,
  type PaymentReceiptUploadedPayload,
} from "@/lib/orders/events";
import type { OrderStatus } from "@/lib/orders/types";
import type { OrderAdminSummary, OrderRecord, OrderPaymentRecord } from "@/lib/orders/types";
import { formatBangkokTimestamp } from "@/lib/timezone";
import { OrderDetailModal } from "./order-detail-modal";
import { statusBadgeClass, statusLabel } from "@/lib/orders/format";
import { RejectOrderDialog, type CancelOrderData } from "./reject-order-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AdminOrdersDictionary = typeof adminOrdersDictionary;

// Tab definitions matching the order workflow
const WORKFLOW_TABS = [
  { key: "received", statuses: ["order_processing"] as OrderStatus[], icon: Package },
  { key: "waitForPayment", statuses: ["awaiting_payment", "payment_review"] as OrderStatus[], icon: CreditCard },
  { key: "paid", statuses: ["order_in_kitchen"] as OrderStatus[], icon: ChefHat },
  { key: "handToDelivery", statuses: ["order_out_for_delivery"] as OrderStatus[], icon: Truck },
  { key: "delivered", statuses: ["delivered"] as OrderStatus[], icon: CheckCircle2 },
  { key: "refunds", statuses: ["cancelled"] as OrderStatus[], icon: RotateCcw },
  { key: "closed", statuses: ["closed"] as OrderStatus[], icon: Archive },
] as const;

type TabKey = typeof WORKFLOW_TABS[number]["key"];

type Props = {
  initialOrders: OrderAdminSummary[];
  dictionary: AdminOrdersDictionary;
};

const ORDER_SOUND_SRC = "/api/admin/sounds/order";
const PAYMENT_SOUND_SRC = "/api/admin/sounds/payment";

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export function OrderListClient({ initialOrders, dictionary }: Props) {
  const [orders, setOrders] = useState<OrderAdminSummary[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<TabKey>("received");
  const [actionState, setActionState] = useState<Record<string, "idle" | "saving">>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderAdminSummary | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Accept modal state for entering delivery fee
  const [acceptTarget, setAcceptTarget] = useState<OrderAdminSummary | null>(null);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);

  // Hand-off modal state
  const [handoffTarget, setHandoffTarget] = useState<OrderAdminSummary | null>(null);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffVendor, setHandoffVendor] = useState("");
  const [handoffTrackingUrl, setHandoffTrackingUrl] = useState("");
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);

  // Payment verification modal state
  const [verifyTarget, setVerifyTarget] = useState<OrderAdminSummary | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<{
    receiptUrl: string | null;
    amount: number;
  } | null>(null);

  // Fullscreen slip lightbox state
  const [slipLightboxOpen, setSlipLightboxOpen] = useState(false);

  // Slip rejection modal state (separate from order rejection)
  const [slipRejectTarget, setSlipRejectTarget] = useState<OrderAdminSummary | null>(null);
  const [slipRejectModalOpen, setSlipRejectModalOpen] = useState(false);
  const [slipRejectReason, setSlipRejectReason] = useState("");
  const [slipRejectSubmitting, setSlipRejectSubmitting] = useState(false);

  // Track seen event IDs to prevent duplicate processing on reconnect
  const seenEventsRef = useRef<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const audioPlayingRef = useRef(false);
  const soundReadyRef = useRef(false);

  const playNextSound = useCallback(() => {
    if (audioPlayingRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const nextSrc = audioQueueRef.current.shift();
    if (!nextSrc) return;

    audioPlayingRef.current = true;
    audio.src = new URL(nextSrc, window.location.origin).toString();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        audioPlayingRef.current = false;
        playNextSound();
      });
    }
  }, []);

  const enqueueSound = useCallback(
    (src: string) => {
      audioQueueRef.current.push(src);
      if (soundReadyRef.current) {
        playNextSound();
      }
    },
    [playNextSound]
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";

    const handleEnded = () => {
      audioPlayingRef.current = false;
      playNextSound();
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleEnded);

    audioRef.current = audio;

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, [playNextSound]);

  useEffect(() => {
    const handleReady = () => {
      soundReadyRef.current = true;
      playNextSound();
    };

    window.addEventListener("pointerdown", handleReady, { once: true });
    window.addEventListener("keydown", handleReady, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleReady);
      window.removeEventListener("keydown", handleReady);
    };
  }, [playNextSound]);

  // Group orders by tab
  const ordersByTab = useMemo(() => {
    const grouped: Record<TabKey, OrderAdminSummary[]> = {
      received: [],
      waitForPayment: [],
      paid: [],
      handToDelivery: [],
      delivered: [],
      refunds: [],
      closed: [],
    };

    for (const order of orders) {
      const tab = WORKFLOW_TABS.find((t) =>
        t.statuses.includes(order.status as OrderStatus)
      );
      if (tab) {
        grouped[tab.key].push(order);
      }
    }

    return grouped;
  }, [orders]);

  // Get tab label from dictionary
  const getTabLabel = (key: TabKey) => {
    const labels: Record<TabKey, string> = {
      received: dictionary.tabReceived ?? "Received",
      waitForPayment: dictionary.tabWaitForPayment ?? "Wait for Payment",
      paid: dictionary.tabPaid ?? "Paid",
      handToDelivery: dictionary.tabHandToDelivery ?? "Hand to Delivery",
      delivered: dictionary.tabDelivered ?? "Delivered",
      refunds: dictionary.tabRefunds ?? "Refunds",
      closed: dictionary.tabClosed ?? "Closed",
    };
    return labels[key];
  };

  const getTabEmptyMessage = (key: TabKey) => {
    const messages: Record<TabKey, string> = {
      received: dictionary.tabReceivedEmpty ?? "No new orders",
      waitForPayment: dictionary.tabWaitForPaymentEmpty ?? "No orders awaiting payment",
      paid: dictionary.tabPaidEmpty ?? "No orders ready for delivery",
      handToDelivery: dictionary.tabHandToDeliveryEmpty ?? "No orders out for delivery",
      delivered: dictionary.tabDeliveredEmpty ?? "No delivered orders",
      refunds: dictionary.tabRefundsEmpty ?? "No refunds pending",
      closed: dictionary.tabClosedEmpty ?? "No closed orders",
    };
    return messages[key];
  };

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

  // Fetch payment details for verification modal
  const fetchPaymentDetails = useCallback(async (order: OrderAdminSummary) => {
    try {
      const response = await fetch(`/api/orders/${order.displayId}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.order) {
        const orderData = json.order as OrderRecord;
        // Get payment receipt from the order's payment records
        if (orderData.payments && orderData.payments.length > 0) {
          const payment = orderData.payments.find(
            (p: OrderPaymentRecord) => p.type === "combined" && p.receiptUrl
          );
          if (payment) {
            setPaymentReceipt({
              receiptUrl: payment.receiptUrl,
              amount: payment.amount,
            });
          }
        }
      }
    } catch {
      // Ignore errors, we'll show the modal without the receipt
    }
  }, []);

  // WORKFLOW ACTIONS

  // Accept order: RECEIVED → WAIT_FOR_PAYMENT
  const handleAcceptOrder = useCallback(
    async (order: OrderAdminSummary, deliveryFee: number) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "accept", deliveryFee }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "awaiting_payment" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Verify payment: WAIT_FOR_PAYMENT → PAID
  const handleVerifyPayment = useCallback(
    async (order: OrderAdminSummary) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/verify-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "order_in_kitchen" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Reject payment slip (customer can re-upload)
  const handleRejectSlip = useCallback(
    async (order: OrderAdminSummary, reason: string) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/reject-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason || undefined }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "awaiting_payment" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.slipRejectedToast ?? "Slip rejected - customer can re-upload");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.slipRejectedToast]
  );

  // Hand off to delivery: PAID → HAND_TO_DELIVERY
  const handleHandoff = useCallback(
    async (
      order: OrderAdminSummary,
      courierVendor: string,
      courierTrackingUrl: string
    ) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "handed_off",
              courierVendor,
              courierTrackingUrl,
            }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "order_out_for_delivery" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Mark delivered: HAND_TO_DELIVERY → DELIVERED
  const handleMarkDelivered = useCallback(
    async (order: OrderAdminSummary) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delivered" }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "delivered" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Close order: DELIVERED → CLOSED
  const handleCloseOrder = useCallback(
    async (order: OrderAdminSummary) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "close" }),
          }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? dictionary.errorLoading);
        }
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id
              ? { ...item, status: "closed" as OrderStatus }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Cancel order
  const handleCancelOrder = useCallback(
    async (order: OrderAdminSummary, data: CancelOrderData) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
      try {
        const response = await fetch(
          `/api/admin/orders/${order.displayId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "cancel",
              reason: data.reason,
              refundType: data.refundType,
              refundAmount: data.refundAmount,
              refundReason: data.refundReason,
            }),
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
                  status: "cancelled" as OrderStatus,
                  refundStatus: payload?.refundStatus ?? item.refundStatus ?? null,
                  refundType: payload?.refundType ?? data.refundType ?? null,
                  refundAmount: payload?.refundAmount ?? data.refundAmount ?? null,
                }
              : item
          )
        );
        toast.success(dictionary.statusUpdatedToast);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  const handleMarkRefundPaid = useCallback(
    async (order: OrderAdminSummary) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
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
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  const handleMarkRefundRequested = useCallback(
    async (order: OrderAdminSummary) => {
      setActionState((prev) => ({ ...prev, [order.id]: "saving" }));
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
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : dictionary.errorLoading
        );
        return false;
      } finally {
        setActionState((prev) => ({ ...prev, [order.id]: "idle" }));
      }
    },
    [dictionary.errorLoading, dictionary.statusUpdatedToast]
  );

  // Modal handlers
  const handleAcceptWithFee = useCallback(async () => {
    if (!acceptTarget) return;

    const rawFee = deliveryFeeInput.trim();
    const feeValue = rawFee === "" ? 0 : Number(rawFee);

    if (!Number.isFinite(feeValue) || feeValue < 0) {
      toast.error("Delivery fee must be a non-negative number");
      return;
    }

    setAcceptSubmitting(true);
    const success = await handleAcceptOrder(acceptTarget, feeValue);
    setAcceptSubmitting(false);

    if (success) {
      setAcceptModalOpen(false);
      setAcceptTarget(null);
      setDeliveryFeeInput("");
    }
  }, [acceptTarget, deliveryFeeInput, handleAcceptOrder]);

  const handleHandoffSubmit = useCallback(async () => {
    if (!handoffTarget) return;

    if (!handoffTrackingUrl.trim()) {
      toast.error("Tracking URL is required");
      return;
    }

    setHandoffSubmitting(true);
    const success = await handleHandoff(
      handoffTarget,
      handoffVendor.trim(),
      handoffTrackingUrl.trim()
    );
    setHandoffSubmitting(false);

    if (success) {
      setHandoffModalOpen(false);
      setHandoffTarget(null);
      setHandoffVendor("");
      setHandoffTrackingUrl("");
    }
  }, [handoffTarget, handoffVendor, handoffTrackingUrl, handleHandoff]);

  const handleVerifySubmit = useCallback(async () => {
    if (!verifyTarget) return;

    setVerifySubmitting(true);
    const success = await handleVerifyPayment(verifyTarget);
    setVerifySubmitting(false);

    if (success) {
      setVerifyModalOpen(false);
      setVerifyTarget(null);
      setPaymentReceipt(null);
    }
  }, [verifyTarget, handleVerifyPayment]);

  const handleRejectSubmit = useCallback(
    async (data: CancelOrderData) => {
      if (!rejectTarget) return;
      setRejectSubmitting(true);
      const success = await handleCancelOrder(rejectTarget, data);
      setRejectSubmitting(false);
      if (success) {
        setRejectDialogOpen(false);
        setRejectTarget(null);
      }
    },
    [rejectTarget, handleCancelOrder]
  );

  // Handle slip rejection modal submit
  const handleSlipRejectSubmit = useCallback(async () => {
    if (!slipRejectTarget) return;
    setSlipRejectSubmitting(true);
    const success = await handleRejectSlip(slipRejectTarget, slipRejectReason);
    setSlipRejectSubmitting(false);
    if (success) {
      setSlipRejectModalOpen(false);
      setSlipRejectTarget(null);
      setSlipRejectReason("");
      // Also close the verify modal if open
      setVerifyModalOpen(false);
      setVerifyTarget(null);
      setPaymentReceipt(null);
    }
  }, [slipRejectTarget, slipRejectReason, handleRejectSlip]);

  // Pusher realtime events
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }
    const channel = pusher.subscribe(ADMIN_ORDERS_CHANNEL);
    const seenEvents = seenEventsRef.current;

    const handleSubmitted = (payload: OrderSubmittedPayload) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      toast.success(dictionary.newOrderToast);
      enqueueSound(ORDER_SOUND_SRC);

      const summary: OrderAdminSummary = {
        id: payload.orderId,
        displayId: payload.displayId,
        displayDay: payload.displayDay,
        status: payload.status,
        refundStatus: null,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        subtotal: payload.totalAmount,
        deliveryFee: null,
        totalAmount: payload.totalAmount,
        deliveryLabel: payload.deliveryLabel,
        createdAt: payload.at,
        hasVerifiedPayment: false,
      };

      setOrders((prev) => [summary, ...prev]);
    };

    const handleStatusChanged = (payload: OrderStatusChangedPayload) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? {
                ...order,
                status: payload.toStatus,
                // Update amounts if provided (e.g. when order is accepted with delivery fee)
                ...(payload.subtotal !== undefined && { subtotal: payload.subtotal }),
                ...(payload.deliveryFee !== undefined && { deliveryFee: payload.deliveryFee }),
                ...(payload.totalAmount !== undefined && { totalAmount: payload.totalAmount }),
                // Mark payment as verified when transitioning to order_in_kitchen (payment was just verified)
                ...(payload.toStatus === "order_in_kitchen" && { hasVerifiedPayment: true }),
                // Include refund info when cancelling
                ...(payload.refundType !== undefined && { refundType: payload.refundType }),
                ...(payload.refundAmount !== undefined && { refundAmount: payload.refundAmount }),
              }
            : order
        )
      );
      toast.message(dictionary.statusUpdatedToast);
    };

    const handleClosed = (payload: OrderClosedPayload) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: payload.finalStatus }
            : order
        )
      );
    };

    const handlePaymentReceiptUploaded = (
      payload: PaymentReceiptUploadedPayload
    ) => {
      if (seenEvents.has(payload.eventId)) return;
      seenEvents.add(payload.eventId);

      toast.message("Payment slip received!");
      enqueueSound(PAYMENT_SOUND_SRC);

      setOrders((prev) =>
        prev.map((order) =>
          order.id === payload.orderId
            ? { ...order, status: "payment_review" as OrderStatus }
            : order
        )
      );
    };

    channel.bind(ORDER_SUBMITTED_EVENT, handleSubmitted);
    channel.bind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);
    channel.bind(ORDER_CLOSED_EVENT, handleClosed);
    channel.bind(PAYMENT_RECEIPT_UPLOADED_EVENT, handlePaymentReceiptUploaded);

    return () => {
      channel.unbind(ORDER_SUBMITTED_EVENT, handleSubmitted);
      channel.unbind(ORDER_STATUS_CHANGED_EVENT, handleStatusChanged);
      channel.unbind(ORDER_CLOSED_EVENT, handleClosed);
      channel.unbind(PAYMENT_RECEIPT_UPLOADED_EVENT, handlePaymentReceiptUploaded);
      pusher.unsubscribe(ADMIN_ORDERS_CHANNEL);
    };
  }, [dictionary.newOrderToast, dictionary.statusUpdatedToast, enqueueSound]);

  // Render primary action button for each tab
  const renderPrimaryAction = (order: OrderAdminSummary) => {
    const isSaving = actionState[order.id] === "saving";

    switch (order.status) {
      case "order_processing":
        return (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isSaving}
            onClick={() => {
              setAcceptTarget(order);
              setDeliveryFeeInput("");
              setAcceptModalOpen(true);
            }}
          >
            {dictionary.actionAccept ?? "Accept Order"}
          </Button>
        );

      case "awaiting_payment":
        return (
          <span className="text-sm text-amber-600 font-medium">
            Waiting for customer to pay...
          </span>
        );

      case "payment_review":
        return (
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => {
              setVerifyTarget(order);
              setPaymentReceipt(null);
              setSlipLightboxOpen(false);
              fetchPaymentDetails(order);
              setVerifyModalOpen(true);
            }}
          >
            {dictionary.actionVerifyPayment ?? "Verify Payment"}
          </Button>
        );

      case "order_in_kitchen":
        return (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isSaving}
            onClick={() => {
              setHandoffTarget(order);
              setHandoffVendor("");
              setHandoffTrackingUrl("");
              setHandoffModalOpen(true);
            }}
          >
            {dictionary.actionHandToDelivery ?? "Hand to Delivery"}
          </Button>
        );

      case "order_out_for_delivery":
        return (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isSaving}
            onClick={() => void handleMarkDelivered(order)}
          >
            {dictionary.actionMarkDelivered ?? "Mark Delivered"}
          </Button>
        );

      case "delivered":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => void handleCloseOrder(order)}
          >
            {dictionary.actionClose ?? "Close Order"}
          </Button>
        );

      case "cancelled":
        // No verified payment or refund type is "none" - show close button
        if (!order.hasVerifiedPayment || order.refundType === "none") {
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={() => void handleCloseOrder(order)}
            >
              {dictionary.closeOrder ?? "Close Order"}
            </Button>
          );
        }
        // Refund paid - show close button
        if (order.refundStatus === "paid") {
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-600">
                {dictionary.statusRefundPaid ?? "Refund paid"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleCloseOrder(order)}
              >
                {dictionary.closeOrder ?? "Close Order"}
              </Button>
            </div>
          );
        }
        // Refund requested - show mark paid button
        if (order.refundStatus === "requested") {
          return (
            <div className="flex flex-col items-end gap-1">
              {order.refundAmount != null && order.refundAmount > 0 && (
                <span className="text-xs text-amber-600">
                  Refund: {formatCurrency(order.refundAmount)}
                </span>
              )}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isSaving}
                onClick={() => void handleMarkRefundPaid(order)}
              >
                {dictionary.actionMarkRefundPaid ?? "Mark refund paid"}
              </Button>
            </div>
          );
        }
        // Has verified payment but no refund status yet - show mark requested button
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => void handleMarkRefundRequested(order)}
          >
            {dictionary.actionMarkRefundRequested ?? "Mark refund requested"}
          </Button>
        );

      default:
        return null;
    }
  };

  // Render order card
  const renderOrderCard = (order: OrderAdminSummary) => {
    const showSlipReceived = order.status === "payment_review";
    const isTerminal =
      order.status === "cancelled" ||
      order.status === "delivered" ||
      order.status === "closed";

    return (
      <div
        key={order.id}
        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              #{order.displayId}
            </span>
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                statusBadgeClass(order.status)
              )}
            >
              {statusLabel(order.status, dictionary, {
                refundStatus: order.refundStatus,
              })}
            </span>
            {showSlipReceived && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 animate-pulse">
                <ImageIcon className="w-3 h-3 mr-1" />
                Slip Received
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="font-medium">{order.customerName}</span>
            <span className="text-slate-400">•</span>
            <span>{order.deliveryLabel}</span>
          </div>
          <p className="text-xs text-slate-400">
            {formatBangkokTimestamp(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-slate-900">
              {formatCurrency(order.totalAmount)}
            </p>
            {order.deliveryFee != null && order.deliveryFee > 0 && (
              <p className="text-xs text-slate-500">
                {dictionary.subtotalLabel ?? "Subtotal"}: {formatCurrency(order.subtotal)} + {dictionary.deliveryFeeLabel ?? "Delivery"}: {formatCurrency(order.deliveryFee)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {renderPrimaryAction(order)}

            {!isTerminal && order.status !== "awaiting_payment" && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => {
                  setRejectTarget(order);
                  setRejectDialogOpen(true);
                }}
              >
                {/* After payment verified (order_in_kitchen onwards), show "Cancel Order" instead of "Reject Order" */}
                {order.status === "order_processing" || order.status === "payment_review"
                  ? (dictionary.actionReject ?? "Reject Order")
                  : (dictionary.actionCancel ?? "Cancel Order")}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              disabled={loadingOrderId === order.id}
              onClick={() => void handleViewOrder(order)}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
        {WORKFLOW_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = ordersByTab[tab.key].length;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{getTabLabel(tab.key)}</span>
              <span
                className={clsx(
                  "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold",
                  isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {ordersByTab[activeTab].length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            {WORKFLOW_TABS.find((t) => t.key === activeTab)?.icon && (
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                {(() => {
                  const Icon = WORKFLOW_TABS.find((t) => t.key === activeTab)?.icon;
                  return Icon ? <Icon className="w-6 h-6" /> : null;
                })()}
              </div>
            )}
            <p className="text-sm">{getTabEmptyMessage(activeTab)}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ordersByTab[activeTab].map((order) => renderOrderCard(order))}
          </div>
        )}
      </div>

      {/* Modals */}
      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dictionary={dictionary}
      />

      <RejectOrderDialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectTarget(null);
          }
        }}
        dictionary={dictionary}
        isSubmitting={rejectSubmitting}
        onSubmit={handleRejectSubmit}
        hasVerifiedPayment={rejectTarget?.hasVerifiedPayment ?? false}
        orderAmounts={rejectTarget ? {
          subtotal: rejectTarget.subtotal,
          deliveryFee: rejectTarget.deliveryFee,
          totalAmount: rejectTarget.totalAmount,
        } : undefined}
      />

      {/* Accept Order Modal */}
      <Dialog
        open={acceptModalOpen}
        onOpenChange={(open) => {
          setAcceptModalOpen(open);
          if (!open) {
            setAcceptTarget(null);
            setDeliveryFeeInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-600">
              {dictionary.acceptModalTitle ?? "Accept Order"}
            </DialogTitle>
          </DialogHeader>
          {acceptTarget && (
            <div className="space-y-4">
              {/* Order Summary Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Order Details
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order ID</span>
                    <span className="font-semibold text-slate-900">
                      {acceptTarget.displayId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-semibold text-slate-900">
                      {acceptTarget.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-700">
                      {acceptTarget.deliveryLabel}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Food Total</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(acceptTarget.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Fee Input Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Set Delivery Fee
                </h4>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder={
                    dictionary.acceptDeliveryFeePlaceholder ??
                    "Enter delivery fee (0 for pickup)"
                  }
                />
              </div>

              {/* Total Summary Section */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-700">
                    {dictionary.acceptCustomerPays ?? "Customer Pays"}
                  </span>
                  <span className="text-lg font-bold text-emerald-800">
                    {formatCurrency(
                      acceptTarget.totalAmount + (Number(deliveryFeeInput) || 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAcceptModalOpen(false);
                    setAcceptTarget(null);
                    setDeliveryFeeInput("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={acceptSubmitting}
                  onClick={() => void handleAcceptWithFee()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {acceptSubmitting
                    ? (dictionary.acceptSubmitting ?? "Accepting...")
                    : (dictionary.acceptSubmit ?? "Accept Order")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verify Payment Modal */}
      <Dialog
        open={verifyModalOpen}
        onOpenChange={(open) => {
          // Don't close the modal if the lightbox is open - just close the lightbox instead
          if (!open && slipLightboxOpen) {
            setSlipLightboxOpen(false);
            return;
          }
          setVerifyModalOpen(open);
          if (!open) {
            setVerifyTarget(null);
            setPaymentReceipt(null);
            setSlipLightboxOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {dictionary.verifyPaymentModalTitle ?? "Verify Payment"}
            </DialogTitle>
          </DialogHeader>
          {verifyTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order</span>
                  <span className="font-semibold text-slate-900">
                    {verifyTarget.displayId}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">
                    {dictionary.verifyPaymentAmountLabel ?? "Expected Amount"}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(
                      paymentReceipt?.amount ?? verifyTarget.totalAmount
                    )}
                  </span>
                </div>
              </div>

              {/* Payment slip preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {dictionary.verifyPaymentSlipLabel ?? "Payment Slip"}
                </label>
                {paymentReceipt?.receiptUrl ? (
                  <button
                    type="button"
                    onClick={() => setSlipLightboxOpen(true)}
                    className="relative w-full aspect-[3/4] max-h-80 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-zoom-in hover:ring-2 hover:ring-emerald-400 transition-all group"
                  >
                    <Image
                      src={paymentReceipt.receiptUrl}
                      alt="Payment slip"
                      fill
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Tap to enlarge
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-center aspect-[3/4] max-h-80 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Loading slip...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    // Open slip rejection modal (NOT order rejection)
                    if (verifyTarget) {
                      setSlipRejectTarget(verifyTarget);
                      setSlipRejectReason("");
                      setSlipRejectModalOpen(true);
                    }
                  }}
                >
                  {dictionary.verifyPaymentReject ?? "Reject Slip"}
                </Button>
                <Button
                  disabled={verifySubmitting}
                  onClick={() => void handleVerifySubmit()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {verifySubmitting
                    ? "Verifying..."
                    : (dictionary.verifyPaymentConfirm ?? "Confirm Payment")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Slip Rejection Modal (separate from order rejection) */}
      <Dialog
        open={slipRejectModalOpen}
        onOpenChange={(open) => {
          setSlipRejectModalOpen(open);
          if (!open) {
            setSlipRejectTarget(null);
            setSlipRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600">
              {dictionary.slipRejectModalTitle ?? "Reject Payment Slip"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {dictionary.slipRejectModalDescription ?? "The customer will be notified and can upload a new payment slip."}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {dictionary.slipRejectReasonLabel ?? "Reason (optional)"}
              </label>
              <textarea
                value={slipRejectReason}
                onChange={(e) => setSlipRejectReason(e.target.value)}
                placeholder={dictionary.slipRejectReasonPlaceholder ?? "e.g., Amount doesn't match, unclear image..."}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSlipRejectModalOpen(false);
                  setSlipRejectTarget(null);
                  setSlipRejectReason("");
                }}
              >
                {dictionary.slipRejectCancel ?? "Close"}
              </Button>
              <Button
                disabled={slipRejectSubmitting}
                onClick={() => void handleSlipRejectSubmit()}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {slipRejectSubmitting
                  ? (dictionary.slipRejectSubmitting ?? "Rejecting...")
                  : (dictionary.slipRejectSubmit ?? "Reject Slip")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hand to Delivery Modal */}
      <Dialog
        open={handoffModalOpen}
        onOpenChange={(open) => {
          setHandoffModalOpen(open);
          if (!open) {
            setHandoffTarget(null);
            setHandoffVendor("");
            setHandoffTrackingUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-600">
              {dictionary.handToDeliveryModalTitle ?? "Hand to Delivery"}
            </DialogTitle>
          </DialogHeader>
          {handoffTarget && (
            <div className="space-y-4">
              {/* Order Summary Card */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{dictionary.orderIdLabel ?? "Order"}</span>
                    <span className="font-bold text-emerald-700">
                      #{handoffTarget.displayId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{dictionary.customerLabel ?? "Customer"}</span>
                    <span className="font-semibold text-slate-900">
                      {handoffTarget.customerName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{dictionary.locationLabel ?? "Delivery to"}</span>
                    <span className="font-medium text-slate-700 text-right max-w-[200px] truncate">
                      {handoffTarget.deliveryLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-emerald-100 pt-2 mt-1">
                    <span className="text-slate-500">{dictionary.totalLabel ?? "Total"}</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(handoffTarget.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tracking Info Section */}
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {dictionary.handoffDescription ?? "Enter the delivery tracking details before handing off to the courier."}
                </p>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    {dictionary.handoffVendorLabel ?? "Courier vendor (optional)"}
                  </label>
                  <input
                    type="text"
                    value={handoffVendor}
                    onChange={(e) => setHandoffVendor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Grab, Bolt, Lalamove, etc."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    {dictionary.handoffTrackingLabel ?? "Delivery tracking link"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={handoffTrackingUrl}
                    onChange={(e) => setHandoffTrackingUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="https://grab.com/tracking/..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setHandoffModalOpen(false);
                    setHandoffTarget(null);
                    setHandoffVendor("");
                    setHandoffTrackingUrl("");
                  }}
                >
                  {dictionary.handoffCancel ?? "Close"}
                </Button>
                <Button
                  disabled={handoffSubmitting || !handoffTrackingUrl.trim()}
                  onClick={() => void handleHandoffSubmit()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {handoffSubmitting
                    ? (dictionary.handoffSubmitting ?? "Handing off...")
                    : (dictionary.handToDeliveryConfirm ?? "Confirm Handoff")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Slip Lightbox */}
      {slipLightboxOpen && paymentReceipt?.receiptUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setSlipLightboxOpen(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSlipLightboxOpen(false);
            }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div
            className="relative w-full h-full max-w-3xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Image
              src={paymentReceipt.receiptUrl}
              alt="Payment slip - full size"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
              priority
            />
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
