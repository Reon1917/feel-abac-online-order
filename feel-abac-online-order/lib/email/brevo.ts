type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  timeoutMs?: number;
  throwOnFailure?: boolean;
};

const DEFAULT_BREVO_BASE_URL = "https://api.brevo.com/v3";

function maskEmailForLog(email: string) {
  const normalized = email.trim();
  if (!normalized) return "[redacted-email]";

  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return "[redacted-email]";
  }

  const domain = normalized.slice(atIndex + 1);
  return `***@${domain}`;
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Feel ABAC";
  const baseUrl = process.env.BREVO_BASE_URL ?? DEFAULT_BREVO_BASE_URL;

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[brevo] BREVO_API_KEY or BREVO_SENDER_EMAIL is not set. Emails will not be sent."
      );
    }
    return null;
  }

  return {
    apiKey,
    senderEmail,
    senderName,
    baseUrl,
  };
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const config = getBrevoConfig();
  if (!config) {
    if (input.throwOnFailure) {
      throw new Error("Email service is not configured.");
    }
    return;
  }

  const { apiKey, senderEmail, senderName, baseUrl } = config;
  const to = input.to?.trim();
  const subject = input.subject?.trim();

  if (!to || !subject) {
    if (input.throwOnFailure) {
      throw new Error("Email recipient and subject are required.");
    }
    return;
  }

  const parsedTimeoutMs = Number(input.timeoutMs);
  const normalizedTimeoutMs = Number.isFinite(parsedTimeoutMs)
    ? Math.floor(parsedTimeoutMs)
    : 10_000;
  const timeoutMs = Math.min(Math.max(normalizedTimeoutMs, 100), 120_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/smtp/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        textContent: input.text || undefined,
        htmlContent: input.html || undefined,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");

      if (process.env.NODE_ENV !== "production") {
        console.error("[brevo] Failed to send email", {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          sender: senderEmail,
          to: maskEmailForLog(to),
        });
      }

      if (input.throwOnFailure) {
        throw new Error(
          `Brevo responded with ${response.status} ${response.statusText}`.trim()
        );
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[brevo] Error while sending email", error);
    }

    if (input.throwOnFailure) {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}
