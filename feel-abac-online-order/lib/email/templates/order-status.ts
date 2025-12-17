import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

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

export type OrderStatusEmailTemplateInput = {
  displayId: string;
  locale?: Locale;
  courierTrackingUrl?: string | null;
};

export type OrderStatusEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function buildOrderUrl(locale: Locale, displayId: string) {
  const path = withLocalePath(locale, `/orders/${displayId}`);
  return `${getAppBaseUrl()}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildOrderStatusEmail(
  template: OrderStatusEmailTemplateKey,
  input: OrderStatusEmailTemplateInput
): OrderStatusEmailContent {
  const displayId = input.displayId.trim();
  const locale = input.locale ?? "en";
  const orderUrl = buildOrderUrl(locale, displayId);

  if (template === "proceed_to_payment") {
    const subject = `Proceed to Payment – ${displayId}`;
    const text = [
      `Your order ${displayId} has been accepted.`,
      "",
      "Please open Feel ABAC and complete payment:",
      `1) Open your order: ${orderUrl}`,
      "2) Pay via PromptPay QR.",
      "3) Upload your payment slip in the order screen.",
      "",
      "We’ll notify you once your payment is verified.",
    ].join("\n");

    const html = [
      `<p>Your order <strong>${escapeHtml(displayId)}</strong> has been accepted.</p>`,
      "<p>Please open Feel ABAC and complete payment:</p>",
      "<ol>",
      `<li>Open your order: <a href=\"${escapeHtml(orderUrl)}\">${escapeHtml(orderUrl)}</a></li>`,
      "<li>Pay via PromptPay QR.</li>",
      "<li>Upload your payment slip in the order screen.</li>",
      "</ol>",
      "<p>We’ll notify you once your payment is verified.</p>",
    ].join("");

    return { subject, text, html };
  }

  if (template === "payment_verified") {
    const subject = `Payment Verified – ${displayId}`;
    const text = [
      `Your payment slip for order ${displayId} has been verified.`,
      "",
      "Your order is now in the kitchen. We’ll notify you when it is handed off for delivery.",
      "",
      `Track your order here: ${orderUrl}`,
    ].join("\n");

    const html = [
      `<p>Your payment slip for order <strong>${escapeHtml(displayId)}</strong> has been verified.</p>`,
      "<p>Your order is now in the kitchen. We’ll notify you when it is handed off for delivery.</p>",
      `<p>Track your order here: <a href=\"${escapeHtml(orderUrl)}\">${escapeHtml(orderUrl)}</a></p>`,
    ].join("");

    return { subject, text, html };
  }

  if (template === "handed_off") {
    const subject = `Order Handed Off for Delivery – ${displayId}`;
    const courierTrackingUrl = input.courierTrackingUrl?.trim() || null;
    const text = [
      `Your order ${displayId} has been handed off to the delivery courier.`,
      "",
      `Open your order for details: ${orderUrl}`,
      courierTrackingUrl ? `Courier tracking link: ${courierTrackingUrl}` : null,
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const html = [
      `<p>Your order <strong>${escapeHtml(displayId)}</strong> has been handed off to the delivery courier.</p>`,
      `<p>Open your order for details: <a href=\"${escapeHtml(orderUrl)}\">${escapeHtml(orderUrl)}</a></p>`,
      courierTrackingUrl
        ? `<p>Courier tracking link: <a href=\"${escapeHtml(courierTrackingUrl)}\">${escapeHtml(courierTrackingUrl)}</a></p>`
        : "",
    ].join("");

    return { subject, text, html };
  }

  const subject = `Order Completed – ${displayId}`;
  const text = [
    `Your order ${displayId} is completed.`,
    "",
    "Thank you for ordering with Feel ABAC.",
    "",
    `View your order: ${orderUrl}`,
  ].join("\n");

  const html = [
    `<p>Your order <strong>${escapeHtml(displayId)}</strong> is completed.</p>`,
    "<p>Thank you for ordering with Feel ABAC.</p>",
    `<p>View your order: <a href=\"${escapeHtml(orderUrl)}\">${escapeHtml(orderUrl)}</a></p>`,
  ].join("");

  return { subject, text, html };
}

