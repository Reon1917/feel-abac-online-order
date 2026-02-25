import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getLinkedProvidersByEmail } from "@/lib/auth/queries";

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

  const email = body.email.trim().toLowerCase();
  const providers = await getLinkedProvidersByEmail(email);
  if (providers.includes("google") && !providers.includes("credential")) {
    return Response.json(
      {
        message:
          "This email is already registered with Google. Please sign in with Google.",
      },
      { status: 409 }
    );
  }

  try {
    return await auth.api.signUpEmail({
      body: {
        ...body,
        email,
      },
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
