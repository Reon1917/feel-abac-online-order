import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    return await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to sign out. Please try again.";
    return Response.json({ message }, { status: 400 });
  }
}
