import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { emailSchema } from "@/lib/validations";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { mapToSupportedLocale } from "@/lib/i18n/utils";
import { hasCredentialAccountByEmail } from "@/lib/auth/queries";

const GENERIC_SUCCESS_MESSAGE =
  "If this email exists in our system, check your email for the reset link.";

function genericSuccessResponse() {
  return NextResponse.json(
    {
      status: true,
      message: GENERIC_SUCCESS_MESSAGE,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawEmail = body && typeof body.email === "string" ? body.email : "";
  const normalizedEmail = rawEmail.trim().toLowerCase();

  const parsed = emailSchema.safeParse(normalizedEmail);

  if (!parsed.success) {
    return genericSuccessResponse();
  }

  const hasCredential = await hasCredentialAccountByEmail(parsed.data);
  if (!hasCredential) {
    // Keep response generic to avoid account enumeration and prevent
    // creating password auth for social-only accounts.
    return genericSuccessResponse();
  }

  try {
    const localeHeader = request.headers.get("x-feel-locale");
    const locale = mapToSupportedLocale(localeHeader) ?? DEFAULT_LOCALE;

    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data,
        redirectTo: `/${locale}/auth/reset-password`,
      },
      headers: request.headers,
    });
    return genericSuccessResponse();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[forgot-password] failed", error);
    }

    return genericSuccessResponse();
  }
}
