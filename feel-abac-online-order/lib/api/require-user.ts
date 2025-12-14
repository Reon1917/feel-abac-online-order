import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";

export async function resolveUserId(request: NextRequest) {
  const authSession = await auth.api.getSession({
    headers: request.headers,
    asResponse: false,
    returnHeaders: false,
  });

  return authSession?.user?.id ?? null;
}
