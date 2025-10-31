import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateUserPhone } from "@/lib/user-profile";
import { onboardingSchema } from "@/lib/validations";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You need to be signed in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = onboardingSchema.safeParse({
      phoneNumber: body.phoneNumber,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid phone number" },
        { status: 400 }
      );
    }

    await updateUserPhone(session.user.id, parsed.data.phoneNumber);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update phone number", error);
    return NextResponse.json(
      { error: "Failed to update phone number" },
      { status: 500 }
    );
  }
}

