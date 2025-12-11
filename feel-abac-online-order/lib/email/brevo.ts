type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const DEFAULT_BREVO_BASE_URL = "https://api.brevo.com/v3";

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
    return;
  }

  const { apiKey, senderEmail, senderName, baseUrl } = config;

  try {
    const response = await fetch(`${baseUrl}/smtp/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: senderName,
        },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
      }),
    });

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.error("[brevo] Failed to send email", {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[brevo] Error while sending email", error);
    }
  }
}
