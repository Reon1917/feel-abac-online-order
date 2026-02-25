import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawPassword =
    body && typeof body.password === "string" ? body.password : "";
  const password = rawPassword.trim().length > 0 ? rawPassword : undefined;

  try {
    const result = await auth.api.deleteUser({
      body: {
        password,
        callbackURL: "/",
      },
      headers: request.headers,
      asResponse: false,
      returnHeaders: false,
    });

    const verificationSent = result?.message === "Verification email sent";
    const status = verificationSent ? "verification_sent" : "deleted";

    return NextResponse.json(
      {
        success: true,
        status,
        verificationSent,
      },
      { status: 200 }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[delete-account] failed", error);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete your account right now.";

    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
