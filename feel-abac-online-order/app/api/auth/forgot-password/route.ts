import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { emailSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawEmail = body && typeof body.email === "string" ? body.email : "";

  const parsed = emailSchema.safeParse(rawEmail);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: true,
        message: "If this email exists in our system, check your email for the reset link.",
      },
      { status: 200 }
    );
  }

  try {
    const response = await auth.api.requestPasswordReset({
      body: {
        email: parsed.data,
        redirectTo: "/auth/reset-password",
      },
      headers: request.headers,
      asResponse: true,
    });

    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[forgot-password] failed", error);
    }

    return NextResponse.json(
      {
        status: true,
        message: "If this email exists in our system, check your email for the reset link.",
      },
      { status: 200 }
    );
  }
}
