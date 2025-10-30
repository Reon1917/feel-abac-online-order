import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.name !== "string"
  ) {
    return Response.json(
      { message: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  try {
    return await auth.api.signUpEmail({
      body,
      headers: request.headers,
      asResponse: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create your account right now.";
    return Response.json({ message }, { status: 400 });
  }
}
