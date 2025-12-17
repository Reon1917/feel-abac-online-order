export type EmailTheme = {
  brandName: string;
  brandColor: string;
  brandColorDark: string;
  canvasColor: string;
  textColor: string;
  mutedTextColor: string;
  cardBorderColor: string;
};

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  brandName: "Feel ABAC",
  // Tailwind emerald-600 / emerald-700 (matches existing UI usage)
  brandColor: "#059669",
  brandColorDark: "#047857",
  canvasColor: "#f8fafc",
  textColor: "#0f172a",
  mutedTextColor: "#475569",
  cardBorderColor: "#e2e8f0",
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPreheader(preheader: string) {
  const safe = escapeHtml(preheader);
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${safe}</div>`;
}

export function renderButton(theme: EmailTheme, href: string, label: string) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">',
    "<tr>",
    `<td bgcolor="${theme.brandColor}" style="border-radius:999px;">`,
    `<a href="${safeHref}" style="display:inline-block;padding:12px 18px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.2px;border-radius:999px;">${safeLabel}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("");
}

export function renderInfoTable(theme: EmailTheme, rows: Array<[string, string]>) {
  const body = rows
    .map(([label, value]) => {
      return [
        "<tr>",
        `<td style="padding:10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${theme.mutedTextColor};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>`,
        `<td style="padding:10px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${theme.textColor};font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>`,
        "</tr>",
      ].join("");
    })
    .join("");

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">`,
    body,
    "</table>",
  ].join("");
}

export function renderCard(theme: EmailTheme, innerHtml: string) {
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid ${theme.cardBorderColor};border-radius:16px;">`,
    "<tr>",
    `<td style="padding:18px;">${innerHtml}</td>`,
    "</tr>",
    "</table>",
  ].join("");
}

export function renderLayout(args: {
  theme?: EmailTheme;
  subject: string;
  preheader: string;
  logoUrl: string;
  contentHtml: string;
  footerHtml?: string;
}) {
  const theme = args.theme ?? DEFAULT_EMAIL_THEME;
  const safeSubject = escapeHtml(args.subject);
  const footerHtml =
    args.footerHtml ??
    `<p style="margin:18px 0 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${theme.mutedTextColor};font-size:12px;line-height:18px;">This is a transactional email related to your order. If you didn’t place this order, you can ignore this message.</p>`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${safeSubject}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background:${theme.canvasColor};">`,
    renderPreheader(args.preheader),
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${theme.canvasColor};padding:24px 12px;">`,
    "<tr>",
    '<td align="center">',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;">`,
    "<tr>",
    "<td>",
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;">`,
    "<tr>",
    `<td style="padding:0 0 14px 0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">`,
    "<tr>",
    `<td style="width:36px;vertical-align:middle;">`,
    `<img src="${escapeHtml(args.logoUrl)}" width="28" height="28" alt="${escapeHtml(theme.brandName)}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;" />`,
    "</td>",
    `<td style="vertical-align:middle;padding-left:10px;">`,
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${theme.textColor};font-size:14px;font-weight:800;letter-spacing:0.2px;">${escapeHtml(theme.brandName)}</div>`,
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:${theme.mutedTextColor};font-size:12px;">Order updates</div>`,
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "<tr>",
    `<td style="padding:0;">`,
    `<div style="height:4px;background:${theme.brandColor};border-radius:999px;"></div>`,
    "</td>",
    "</tr>",
    "<tr>",
    `<td style="padding:14px 0 0 0;">`,
    args.contentHtml,
    footerHtml,
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

export function formatThbAmount(value: string | number | null | undefined) {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return `฿${Math.round(num).toLocaleString("en-US")}`;
}

