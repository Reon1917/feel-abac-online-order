import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getAppBaseUrl } from "@/lib/env/app-base-url";
import {
  DEFAULT_EMAIL_THEME,
  escapeHtml,
  formatThbAmount,
  renderButton,
  renderCard,
  renderInfoTable,
  renderLayout,
} from "@/lib/email/templates/ui";
import { computeOrderTotals, ORDER_VAT_PERCENT_LABEL } from "@/lib/orders/totals";
import type { OrderStatus, RefundStatus, RefundType } from "@/lib/orders/types";

export type OrderStatusEmailTemplateKey =
  | "proceed_to_payment"
  | "payment_verified"
  | "handed_off"
  | "cancelled"
  | "delivered";

// Extended order details for richer email content
export type OrderEmailItem = {
  name: string;
  quantity: number;
  price: number;
  choices?: string[];
  note?: string | null;
};

export type OrderEmailDetails = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string | null;
  orderNote?: string | null;
  subtotal: number;
  vatAmount: number;
  deliveryFee: number | null;
  items: OrderEmailItem[];
};

export type OrderStatusEmailTemplateInput = {
  displayId: string;
  locale?: Locale;
  totalAmount?: string | number | null;
  courierTrackingUrl?: string | null;
  cancelledFromStatus?: OrderStatus | null;
  cancelReason?: string | null;
  refundType?: RefundType | null;
  refundStatus?: RefundStatus | null;
  refundAmount?: string | number | null;
  refundReason?: string | null;
  orderDetails?: OrderEmailDetails | null;
};

export type OrderStatusEmailContent = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

function buildOrderUrl(locale: Locale, displayId: string) {
  const path = withLocalePath(locale, `/orders/${displayId}`);
  return `${getAppBaseUrl()}${path}`;
}

function buildAssetUrl(pathname: string) {
  const base = getAppBaseUrl();
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${normalized}`;
}

function formatOrderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    order_processing: "Order received",
    awaiting_payment: "Awaiting payment",
    payment_review: "Payment review",
    order_in_kitchen: "In kitchen",
    order_out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    closed: "Closed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function formatRefundTypeLabel(refundType: RefundType) {
  const labels: Record<RefundType, string> = {
    full: "Full refund",
    food_only: "Food only",
    delivery_fee_only: "Delivery fee only",
    none: "No refund",
  };
  return labels[refundType];
}

function formatRefundStatusLabel(refundStatus: RefundStatus) {
  const labels: Record<RefundStatus, string> = {
    requested: "Requested",
    paid: "Paid",
  };
  return labels[refundStatus];
}

/** Render order items table for email */
function renderOrderItemsHtml(items: OrderEmailItem[]): string {
  if (!items.length) return "";

  const fontFamily = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";
  const itemRows = items
    .map((item) => {
      const choicesHtml = item.choices?.length
        ? `<div style="font-size:12px;color:${DEFAULT_EMAIL_THEME.mutedTextColor};margin-top:2px;">${item.choices.map(escapeHtml).join(", ")}</div>`
        : "";
      const noteHtml = item.note
        ? `<div style="font-size:12px;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-style:italic;margin-top:2px;">Note: ${escapeHtml(item.note)}</div>`
        : "";
      return [
        "<tr>",
        `<td style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;vertical-align:top;border-bottom:1px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">`,
        `<div>${escapeHtml(item.name)}</div>`,
        choicesHtml,
        noteHtml,
        "</td>",
        `<td style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;text-align:center;vertical-align:top;width:50px;border-bottom:1px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">×${item.quantity}</td>`,
        `<td style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;text-align:right;vertical-align:top;width:80px;border-bottom:1px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">฿${item.price.toLocaleString()}</td>`,
        "</tr>",
      ].join("");
    })
    .join("");

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0;">`,
    "<tr>",
    `<th style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-align:left;border-bottom:2px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">Item</th>`,
    `<th style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-align:center;width:50px;border-bottom:2px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">Qty</th>`,
    `<th style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-align:right;width:80px;border-bottom:2px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">Price</th>`,
    "</tr>",
    itemRows,
    "</table>",
  ].join("");
}

/** Render customer and delivery info section for email */
function renderOrderDetailsHtml(details: OrderEmailDetails): string {
  const fontFamily = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";
  const sections: string[] = [];

  // Customer info
  sections.push(
    `<div style="margin-bottom:12px;">`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Customer</div>`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;">${escapeHtml(details.customerName)}</div>`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">${escapeHtml(details.customerPhone)}</div>`,
    `</div>`
  );

  // Delivery address
  sections.push(
    `<div style="margin-bottom:12px;">`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Delivery Address</div>`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;">${escapeHtml(details.deliveryAddress)}</div>`,
    details.deliveryNotes
      ? `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;font-style:italic;margin-top:2px;">Note: ${escapeHtml(details.deliveryNotes)}</div>`
      : "",
    `</div>`
  );

  // Order note if present
  if (details.orderNote) {
    sections.push(
      `<div style="margin-bottom:12px;">`,
      `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Order Note</div>`,
      `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;font-style:italic;">${escapeHtml(details.orderNote)}</div>`,
      `</div>`
    );
  }

  // Items
  sections.push(
    `<div style="margin-bottom:12px;">`,
    `<div style="font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Order Items</div>`,
    renderOrderItemsHtml(details.items),
    `</div>`
  );

  // Totals
  const totals = computeOrderTotals({
    foodSubtotal: details.subtotal,
    vatAmount: details.vatAmount,
    deliveryFee: details.deliveryFee,
  });
  const subtotalFormatted = `฿${totals.foodSubtotal.toLocaleString()}`;
  const vatFormatted = `฿${totals.vatAmount.toLocaleString()}`;
  const foodTotalFormatted = `฿${totals.foodTotal.toLocaleString()}`;
  const deliveryFeeFormatted =
    totals.deliveryFee > 0 ? `฿${totals.deliveryFee.toLocaleString()}` : "Free";
  const totalFormatted = `฿${totals.totalAmount.toLocaleString()}`;

  sections.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">`,
    `<tr>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">Subtotal</td>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:13px;text-align:right;">${subtotalFormatted}</td>`,
    `</tr>`,
    `<tr>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">VAT (${ORDER_VAT_PERCENT_LABEL})</td>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:13px;text-align:right;">${vatFormatted}</td>`,
    `</tr>`,
    `<tr>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">Food Total</td>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:13px;text-align:right;">${foodTotalFormatted}</td>`,
    `</tr>`,
    `<tr>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">Delivery Fee</td>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:13px;text-align:right;">${deliveryFeeFormatted}</td>`,
    `</tr>`,
    `<tr>`,
    `<td style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:15px;font-weight:700;border-top:2px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">Total</td>`,
    `<td style="padding:8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.brandColor};font-size:15px;font-weight:700;text-align:right;border-top:2px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">${totalFormatted}</td>`,
    `</tr>`,
    `</table>`
  );

  return sections.join("");
}

/** Render order details for plain text email */
function renderOrderDetailsText(details: OrderEmailDetails): string {
  const lines: string[] = [];

  lines.push(`Customer: ${details.customerName}`);
  lines.push(`Phone: ${details.customerPhone}`);
  lines.push(`Delivery Address: ${details.deliveryAddress}`);
  if (details.deliveryNotes) lines.push(`Delivery Note: ${details.deliveryNotes}`);
  if (details.orderNote) lines.push(`Order Note: ${details.orderNote}`);
  lines.push("");
  lines.push("Order Items:");
  for (const item of details.items) {
    let itemLine = `  - ${item.name} ×${item.quantity} — ฿${item.price.toLocaleString()}`;
    if (item.choices?.length) itemLine += ` (${item.choices.join(", ")})`;
    if (item.note) itemLine += ` [Note: ${item.note}]`;
    lines.push(itemLine);
  }
  lines.push("");
  const totals = computeOrderTotals({
    foodSubtotal: details.subtotal,
    vatAmount: details.vatAmount,
    deliveryFee: details.deliveryFee,
  });
  lines.push(`Subtotal: ฿${totals.foodSubtotal.toLocaleString()}`);
  lines.push(`VAT (${ORDER_VAT_PERCENT_LABEL}): ฿${totals.vatAmount.toLocaleString()}`);
  lines.push(`Food Total: ฿${totals.foodTotal.toLocaleString()}`);
  lines.push(`Delivery Fee: ${totals.deliveryFee > 0 ? `฿${totals.deliveryFee.toLocaleString()}` : "Free"}`);
  lines.push(`Total: ฿${totals.totalAmount.toLocaleString()}`);

  return lines.join("\n");
}

export function buildOrderStatusEmail(
  template: OrderStatusEmailTemplateKey,
  input: OrderStatusEmailTemplateInput
): OrderStatusEmailContent {
  const displayId = input.displayId.trim();
  const locale = input.locale ?? "en";
  const orderUrl = buildOrderUrl(locale, displayId);
  const logoUrl = buildAssetUrl("/favicon.ico");
  const amount = formatThbAmount(input.totalAmount);
  const fontFamily = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";

  // Helper to build order details HTML section
  const orderDetailsHtml = input.orderDetails
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">${renderOrderDetailsHtml(input.orderDetails)}</div>`
    : "";

  // Helper to build order details text section
  const orderDetailsText = input.orderDetails
    ? `\n\n${renderOrderDetailsText(input.orderDetails)}`
    : "";

  if (template === "proceed_to_payment") {
    const subject = `Proceed to Payment – ${displayId}`;
    const preheader = `Order ${displayId} accepted — please complete payment.`;
    const text = [
      `Your order ${displayId} has been accepted.`,
      "",
      "Please open Feel ABAC and complete payment:",
      `1) Open your order: ${orderUrl}`,
      "2) Pay via PromptPay QR.",
      "3) Upload your payment slip in the order screen.",
      "",
      "We'll notify you once your payment is verified.",
      orderDetailsText,
    ].join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "Awaiting payment"],
    ];
    if (amount) summaryRows.push(["Total to pay", amount]);

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Your order has been accepted</h1>`,
        `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Proceed to payment via PromptPay QR and upload your payment slip from the order page.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
        orderDetailsHtml,
        `<div style="margin-top:16px;">${renderButton(DEFAULT_EMAIL_THEME, orderUrl, "View order")}</div>`,
      ].join("")
    );

    const html = renderLayout({
      subject,
      preheader,
      logoUrl,
      contentHtml,
    });

    return { subject, preheader, text, html };
  }

  if (template === "payment_verified") {
    const subject = `Payment Verified – ${displayId}`;
    const preheader = `Payment verified for ${displayId} — your order is in the kitchen.`;
    const text = [
      `Your payment slip for order ${displayId} has been verified.`,
      "",
      "Your order is now in the kitchen. We'll notify you when it is handed off for delivery.",
      "",
      `Track your order here: ${orderUrl}`,
      orderDetailsText,
    ].join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "In the kitchen"],
    ];
    if (amount) summaryRows.push(["Total", amount]);

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Payment verified</h1>`,
        `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Your order is now in the kitchen. We'll notify you when it is handed off for delivery.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
        orderDetailsHtml,
        `<div style="margin-top:16px;">${renderButton(DEFAULT_EMAIL_THEME, orderUrl, "View order")}</div>`,
      ].join("")
    );

    const html = renderLayout({
      subject,
      preheader,
      logoUrl,
      contentHtml,
    });

    return { subject, preheader, text, html };
  }

  if (template === "handed_off") {
    const subject = `Order Handed Off for Delivery – ${displayId}`;
    const preheader = `Your order ${displayId} is on the way.`;
    const courierTrackingUrl = input.courierTrackingUrl?.trim() || null;
    const text = [
      `Your order ${displayId} has been handed off to the delivery courier.`,
      "",
      `Open your order for details: ${orderUrl}`,
      courierTrackingUrl ? `Courier tracking link: ${courierTrackingUrl}` : null,
      orderDetailsText,
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "Out for delivery"],
    ];
    if (amount) summaryRows.push(["Total", amount]);

    const trackingHtml = courierTrackingUrl
      ? `<p style="margin:14px 0 0 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;line-height:18px;">Tracking link: <a href="${escapeHtml(courierTrackingUrl)}" style="color:${DEFAULT_EMAIL_THEME.brandColorDark};text-decoration:underline;">${escapeHtml(courierTrackingUrl)}</a></p>`
      : "";

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Handed off for delivery</h1>`,
        `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Your order has been handed off to the courier. You can view tracking details from the order page.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
        trackingHtml,
        orderDetailsHtml,
        `<div style="margin-top:16px;">${renderButton(DEFAULT_EMAIL_THEME, orderUrl, "View order")}</div>`,
      ].join("")
    );

    const html = renderLayout({
      subject,
      preheader,
      logoUrl,
      contentHtml,
    });

    return { subject, preheader, text, html };
  }

  if (template === "cancelled") {
    const subject = `Order Cancelled – ${displayId}`;
    const preheader = `Order ${displayId} was cancelled.`;
    const cancelledFromLabel = input.cancelledFromStatus
      ? formatOrderStatusLabel(input.cancelledFromStatus)
      : "Unknown stage";
    const cancelReasonText = input.cancelReason?.trim() || "No reason provided";
    const hasRefund = input.refundType != null && input.refundType !== "none";
    const refundAmount = formatThbAmount(input.refundAmount);

    const text = [
      `Your order ${displayId} has been cancelled.`,
      "",
      "Cancellation details:",
      `- Cancelled from: ${cancelledFromLabel}`,
      `- Reason: ${cancelReasonText}`,
      hasRefund && input.refundType
        ? `- Refund type: ${formatRefundTypeLabel(input.refundType)}`
        : "- Refund: No refund requested",
      hasRefund && input.refundStatus
        ? `- Refund status: ${formatRefundStatusLabel(input.refundStatus)}`
        : null,
      hasRefund && refundAmount ? `- Refund amount: ${refundAmount}` : null,
      hasRefund && input.refundReason?.trim()
        ? `- Refund note: ${input.refundReason.trim()}`
        : null,
      "",
      `View your order: ${orderUrl}`,
      orderDetailsText,
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "Cancelled"],
      ["Cancelled from", cancelledFromLabel],
    ];
    if (amount) summaryRows.push(["Order total", amount]);

    const cancellationRows: Array<[string, string]> = [
      ["Reason", cancelReasonText],
    ];
    if (hasRefund && input.refundType) {
      cancellationRows.push(["Refund type", formatRefundTypeLabel(input.refundType)]);
      if (input.refundStatus) {
        cancellationRows.push([
          "Refund status",
          formatRefundStatusLabel(input.refundStatus),
        ]);
      }
      if (refundAmount) {
        cancellationRows.push(["Refund amount", refundAmount]);
      }
      if (input.refundReason?.trim()) {
        cancellationRows.push(["Refund note", input.refundReason.trim()]);
      }
    } else {
      cancellationRows.push(["Refund", "No refund requested"]);
    }

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Order cancelled</h1>`,
        `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">This order has been cancelled. Details are included below for your records.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
        `<div style="margin-top:14px;padding-top:14px;border-top:1px solid ${DEFAULT_EMAIL_THEME.cardBorderColor};">`,
        `<h2 style="margin:0 0 8px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:14px;line-height:20px;">Cancellation details</h2>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, cancellationRows),
        `</div>`,
        orderDetailsHtml,
        `<div style="margin-top:16px;">${renderButton(DEFAULT_EMAIL_THEME, orderUrl, "View order")}</div>`,
      ].join("")
    );

    const html = renderLayout({
      subject,
      preheader,
      logoUrl,
      contentHtml,
    });

    return { subject, preheader, text, html };
  }

  // delivered template (default)
  const subject = `Order Completed – ${displayId}`;
  const preheader = `Order ${displayId} completed — thank you.`;
  const receiptUrl = `${getAppBaseUrl()}${withLocalePath(locale, `/orders/${displayId}/receipt`)}`;
  const text = [
    `Your order ${displayId} is completed.`,
    "",
    "Thank you for ordering with Feel ABAC.",
    "",
    `View your order: ${orderUrl}`,
    `Download receipt: ${receiptUrl}`,
    orderDetailsText,
  ].join("\n");

  const summaryRows: Array<[string, string]> = [
    ["Order ID", displayId],
    ["Status", "Completed"],
  ];
  if (amount) summaryRows.push(["Total", amount]);

  // Secondary button style (outline)
  const downloadButtonHtml = [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;display:inline-block;">',
    "<tr>",
    `<td style="border-radius:999px;border:2px solid ${DEFAULT_EMAIL_THEME.brandColor};">`,
    `<a href="${escapeHtml(receiptUrl)}" style="display:inline-block;padding:10px 16px;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.brandColor};text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.2px;border-radius:999px;">Download Receipt</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("");

  const contentHtml = renderCard(
    DEFAULT_EMAIL_THEME,
    [
      `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Order completed</h1>`,
      `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Thank you for ordering with Feel ABAC. Your receipt is below.</p>`,
      renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
      orderDetailsHtml,
      [
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">',
        "<tr>",
        `<td style="padding:0;vertical-align:top;">${renderButton(DEFAULT_EMAIL_THEME, orderUrl, "View order")}</td>`,
        '<td style="width:12px;font-size:0;line-height:0;">&nbsp;</td>',
        `<td style="padding:0;vertical-align:top;">${downloadButtonHtml}</td>`,
        "</tr>",
        "</table>",
      ].join(""),
    ].join("")
  );

  const html = renderLayout({
    subject,
    preheader,
    logoUrl,
    contentHtml,
  });

  return { subject, preheader, text, html };
}
