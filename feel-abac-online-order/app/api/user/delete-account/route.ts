import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password =
    body && typeof body.password === "string" && body.password.length > 0
      ? body.password
      : undefined;

  try {
    const response = await auth.api.deleteUser({
      body: {
        password,
        callbackURL: "/?accountDeleted=1",
      },
      headers: request.headers,
      asResponse: true,
    });

    return response;
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
