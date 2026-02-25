import { getAppBaseUrl } from "@/lib/env/app-base-url";
import {
  DEFAULT_EMAIL_THEME,
  escapeHtml,
  renderButton,
  renderCard,
  renderLayout,
} from "@/lib/email/templates/ui";

type ResetPasswordEmailInput = {
  resetUrl: string;
  expiresInMinutes?: number;
};

export type AuthEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildResetPasswordEmail({
  resetUrl,
  expiresInMinutes = 60,
}: ResetPasswordEmailInput): AuthEmailContent {
  const subject = "Reset your Feel ABAC password";
  const safeResetUrl = resetUrl.trim();
  const logoUrl = `${getAppBaseUrl()}/favicon.ico`;
  const preheader = "Use this secure link to set a new password.";
  const fontFamily =
    "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial";

  const text = [
    "We received a request to reset your Feel ABAC password.",
    "",
    "If you made this request, use the link below to choose a new password:",
    safeResetUrl,
    "",
    `This link expires in ${expiresInMinutes} minutes.`,
    "",
    "If you did not request a password reset, you can safely ignore this email.",
  ].join("\n");

  const contentHtml = renderCard(
    DEFAULT_EMAIL_THEME,
    [
      `<h1 style="margin:0 0 10px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.textColor};font-size:18px;line-height:26px;">Reset your password</h1>`,
      `<p style="margin:0 0 14px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:14px;line-height:20px;">We received a request to reset your Feel ABAC password. Click the button below to choose a new password.</p>`,
      `<div style="margin:0 0 14px 0;">${renderButton(
        DEFAULT_EMAIL_THEME,
        safeResetUrl,
        "Reset password"
      )}</div>`,
      `<p style="margin:0 0 6px 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:12px;line-height:18px;">If the button does not work, copy and paste this link into your browser:</p>`,
      `<p style="margin:0 0 12px 0;font-family:${fontFamily};font-size:12px;line-height:18px;word-break:break-all;"><a href="${escapeHtml(safeResetUrl)}" style="color:${DEFAULT_EMAIL_THEME.brandColor};text-decoration:underline;">${escapeHtml(safeResetUrl)}</a></p>`,
      `<p style="margin:0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:12px;line-height:18px;">This link expires in ${expiresInMinutes} minutes. If you did not request a password reset, you can ignore this email.</p>`,
    ].join("")
  );

  const html = renderLayout({
    subject,
    preheader,
    logoUrl,
    contentHtml,
    footerHtml: `<p style="margin:18px 0 0 0;font-family:${fontFamily};color:${DEFAULT_EMAIL_THEME.mutedTextColor};font-size:12px;line-height:18px;">This is a security email from Feel ABAC. If this request was not made by you, no further action is needed.</p>`,
  });

  return {
    subject,
    text,
    html,
  };
}
