import "server-only";

import { headers } from "next/headers";
import { Buffer } from "node:buffer";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type FeelSession = {
  session: { user: { id: string; email: string; name: string } };
  onboarded: boolean;
  isAdmin?: boolean;
};

export const getSession = cache(async (): Promise<FeelSession | null> => {
  try {
    const headerList = await headers();
    const encoded = headerList.get("x-feel-session");
    if (!encoded) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as FeelSession;

    return decoded;
  } catch (error) {
    console.error("failed to resolve session", error);
    return null;
  }
});

export const getCurrentSession = cache(async () => {
  try {
    const headerList = await headers();
    const encoded = headerList.get("x-feel-session");
    if (!encoded) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as unknown;

    if (
      decoded &&
      typeof decoded === "object" &&
      "session" in decoded &&
      decoded.session &&
      typeof decoded.session === "object"
    ) {
      return decoded.session as Awaited<
        ReturnType<typeof auth.api.getSession>
      >;
    }

    return null;
  } catch (error) {
    console.error("failed to resolve session", error);
    return null;
  }
});
