import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { db, schema } from "@/src/db/client";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { buildResetPasswordEmail } from "@/lib/email/templates/auth";
import { getAppBaseUrl } from "@/lib/env/app-base-url";
import { getAdminByUserId } from "@/lib/admin";

const authBaseUrl = getAppBaseUrl();

export const auth = betterAuth({
  baseURL: authBaseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  account: {
    accountLinking: {
      enabled: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const resetEmail = buildResetPasswordEmail({
        resetUrl: url,
        expiresInMinutes: 60,
      });

      await sendTransactionalEmail({
        to: user.email,
        subject: resetEmail.subject,
        text: resetEmail.text,
        html: resetEmail.html,
        throwOnFailure: true,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Confirm deletion of your Feel ABAC account",
          text: `You requested to delete your Feel ABAC account.\n\nIf this was you, click the link below to permanently delete your account:\n\n${url}\n\nIf you did not request this, you can safely ignore this email.`,
          throwOnFailure: true,
        });
      },
      beforeDelete: async (user) => {
        const admin = await getAdminByUserId(user.id);
        if (admin?.isActive) {
          throw new APIError("BAD_REQUEST", {
            message: "Admin accounts cannot be deleted.",
          });
        }
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET as string,
});
