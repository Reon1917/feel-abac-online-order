import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import {
  DEFAULT_EMAIL_THEME,
  escapeHtml,
  formatThbAmount,
  renderButton,
  renderCard,
  renderInfoTable,
  renderLayout,
} from "@/lib/email/templates/ui";

function getAppBaseUrl() {
  const explicit =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    null;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith("http")
      ? vercelUrl
      : `https://${vercelUrl}`;
    return normalized.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

export type OrderStatusEmailTemplateKey =
  | "proceed_to_payment"
  | "payment_verified"
  | "handed_off"
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
  deliveryFee: number | null;
  items: OrderEmailItem[];
};

export type OrderStatusEmailTemplateInput = {
  displayId: string;
  locale?: Locale;
  totalAmount?: string | number | null;
  courierTrackingUrl?: string | null;
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
  const subtotalFormatted = `฿${details.subtotal.toLocaleString()}`;
  const deliveryFeeFormatted = details.deliveryFee != null ? `฿${details.deliveryFee.toLocaleString()}` : "Free";
  const total = details.subtotal + (details.deliveryFee ?? 0);
  const totalFormatted = `฿${total.toLocaleString()}`;

  sections.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">`,
    `<tr>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;">Subtotal</td>`,
    `<td style="padding:6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:13px;text-align:right;">${subtotalFormatted}</td>`,
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
  lines.push(`Subtotal: ฿${details.subtotal.toLocaleString()}`);
  lines.push(`Delivery Fee: ${details.deliveryFee != null ? `฿${details.deliveryFee.toLocaleString()}` : "Free"}`);
  const total = details.subtotal + (details.deliveryFee ?? 0);
  lines.push(`Total: ฿${total.toLocaleString()}`);

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

  // delivered template (default)
  const subject = `Order Completed – ${displayId}`;
  const preheader = `Order ${displayId} completed — thank you.`;
  const text = [
    `Your order ${displayId} is completed.`,
    "",
    "Thank you for ordering with Feel ABAC.",
    "",
    `View your order: ${orderUrl}`,
    orderDetailsText,
  ].join("\n");

  const summaryRows: Array<[string, string]> = [
    ["Order ID", displayId],
    ["Status", "Completed"],
  ];
  if (amount) summaryRows.push(["Total", amount]);

  const contentHtml = renderCard(
    DEFAULT_EMAIL_THEME,
    [
      `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Order completed</h1>`,
      `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Thank you for ordering with Feel ABAC.</p>`,
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
