import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { passwordSchema } from "@/lib/validations";
import { hasCredentialAccount } from "@/lib/auth/queries";
import { db } from "@/src/db/client";
import { verifications } from "@/src/db/schema";

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
    const [verification] = await db
      .select({ userId: verifications.value })
      .from(verifications)
      .where(
        and(
          eq(verifications.identifier, `reset-password:${token}`),
          gt(verifications.expiresAt, new Date())
        )
      )
      .limit(1);

    if (verification) {
      const userId =
        typeof verification.userId === "string"
          ? verification.userId.trim()
          : "";

      if (!userId) {
        return NextResponse.json(
          { message: "Unable to reset your password. Please try again." },
          { status: 400 }
        );
      }

      const hasPassword = await hasCredentialAccount(userId);
      if (!hasPassword) {
        return NextResponse.json(
          {
            message:
              "This account uses Google sign-in. Please continue with Google instead of resetting a password.",
          },
          { status: 400 }
        );
      }
    }

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
