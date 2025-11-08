import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function resolveUserId(request: NextRequest) {
  const session = await getSession();
  const userId = session?.session?.user?.id;
  if (userId) {
    return userId;
  }

  const authSession = await auth.api.getSession({
    headers: request.headers,
    asResponse: false,
    returnHeaders: false,
  });

  return authSession?.user?.id ?? null;
}
