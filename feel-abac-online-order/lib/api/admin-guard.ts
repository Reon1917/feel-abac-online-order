import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isActiveAdmin } from "@/lib/admin";
import { getSession, type FeelSession } from "@/lib/session";

export async function requireActiveAdmin(): Promise<FeelSession | null> {
  let session = await getSession();
  let userId = session?.session?.user?.id;

  if (!userId) {
    const headerList = await headers();
    const authSession = await auth.api.getSession({
      headers: headerList,
      asResponse: false,
      returnHeaders: false,
    });

    if (!authSession?.user) {
      return null;
    }

    userId = authSession.user.id;
    session = {
      session: {
        user: {
          id: authSession.user.id,
          email: authSession.user.email ?? "",
          name: authSession.user.name ?? "",
        },
      },
      onboarded: true,
      isAdmin: true,
    };
  }

  const active = await isActiveAdmin(userId);
  if (!active) {
    return null;
  }

  const resolvedSession = session as FeelSession;

  return {
    ...resolvedSession,
    isAdmin: true,
  };
}
