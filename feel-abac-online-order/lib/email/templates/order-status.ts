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

export type OrderStatusEmailTemplateInput = {
  displayId: string;
  locale?: Locale;
  totalAmount?: string | number | null;
  courierTrackingUrl?: string | null;
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

export function buildOrderStatusEmail(
  template: OrderStatusEmailTemplateKey,
  input: OrderStatusEmailTemplateInput
): OrderStatusEmailContent {
  const displayId = input.displayId.trim();
  const locale = input.locale ?? "en";
  const orderUrl = buildOrderUrl(locale, displayId);
  const logoUrl = buildAssetUrl("/favicon.ico");
  const amount = formatThbAmount(input.totalAmount);

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
      "We’ll notify you once your payment is verified.",
    ].join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "Awaiting payment"],
    ];
    if (amount) summaryRows.push(["Total to pay", amount]);

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Your order has been accepted</h1>`,
        `<p style="margin:0 0 14px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Proceed to payment via PromptPay QR and upload your payment slip from the order page.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
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
      "Your order is now in the kitchen. We’ll notify you when it is handed off for delivery.",
      "",
      `Track your order here: ${orderUrl}`,
    ].join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "In the kitchen"],
    ];
    if (amount) summaryRows.push(["Total", amount]);

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Payment verified</h1>`,
        `<p style="margin:0 0 14px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Your order is now in the kitchen. We’ll notify you when it is handed off for delivery.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
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
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const summaryRows: Array<[string, string]> = [
      ["Order ID", displayId],
      ["Status", "Out for delivery"],
    ];
    if (amount) summaryRows.push(["Total", amount]);

    const trackingHtml = courierTrackingUrl
      ? `<p style="margin:14px 0 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:13px;line-height:18px;">Tracking link: <a href="${escapeHtml(courierTrackingUrl)}" style="color:${DEFAULT_EMAIL_THEME.brandColorDark};text-decoration:underline;">${escapeHtml(courierTrackingUrl)}</a></p>`
      : "";

    const contentHtml = renderCard(
      DEFAULT_EMAIL_THEME,
      [
        `<h1 style="margin:0 0 10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Handed off for delivery</h1>`,
        `<p style="margin:0 0 14px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Your order has been handed off to the courier. You can view tracking details from the order page.</p>`,
        renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
        trackingHtml,
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

  const subject = `Order Completed – ${displayId}`;
  const preheader = `Order ${displayId} completed — thank you.`;
  const text = [
    `Your order ${displayId} is completed.`,
    "",
    "Thank you for ordering with Feel ABAC.",
    "",
    `View your order: ${orderUrl}`,
  ].join("\n");

  const summaryRows: Array<[string, string]> = [
    ["Order ID", displayId],
    ["Status", "Completed"],
  ];
  if (amount) summaryRows.push(["Total", amount]);

  const contentHtml = renderCard(
    DEFAULT_EMAIL_THEME,
    [
      `<h1 style="margin:0 0 10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Order completed</h1>`,
      `<p style="margin:0 0 14px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">Thank you for ordering with Feel ABAC.</p>`,
      renderInfoTable(DEFAULT_EMAIL_THEME, summaryRows),
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
