import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { passwordSchema } from "@/lib/validations";

const resetPasswordBodySchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = resetPasswordBodySchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        message: firstIssue?.message ?? "Invalid payload",
        field: firstIssue?.path?.[0] ?? null,
      },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;

  try {
    const response = await auth.api.resetPassword({
      body: {
        newPassword,
        token,
      },
      headers: request.headers,
      asResponse: true,
    });

    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[reset-password] failed", error);
    }

    return NextResponse.json(
      { message: "Unable to reset your password. Please try again." },
      { status: 400 }
    );
  }
}
