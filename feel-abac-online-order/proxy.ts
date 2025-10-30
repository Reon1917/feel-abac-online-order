import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";

import { auth } from "./lib/auth";
import { db } from "./src/db/client";
import { userProfiles } from "./src/db/schema";

const AUTH_REQUIRED_PATHS = ["/menu", "/onboarding"];

async function resolveSession(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
      asResponse: false,
      returnHeaders: false,
    });
    return session;
  } catch (error) {
    console.error("proxy session error", error);
    return null;
  }
}

async function hasCompletedOnboarding(userId: string) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  return !!profile?.phoneNumber;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static");
  if (isStatic) {
    return NextResponse.next();
  }

  const session = await resolveSession(request);
  const isAuthenticated = !!session?.user;

  if (
    !isAuthenticated &&
    AUTH_REQUIRED_PATHS.some((path) => pathname.startsWith(path))
  ) {
    const url = new URL("/", request.url);
    return NextResponse.redirect(url);
  }

  let onboarded = false;
  if (isAuthenticated) {
    onboarded = await hasCompletedOnboarding(session.user.id);

    if (!onboarded && pathname !== "/onboarding") {
      const url = new URL("/onboarding", request.url);
      return NextResponse.redirect(url);
    }

    if (onboarded && pathname === "/onboarding") {
      const url = new URL("/menu", request.url);
      return NextResponse.redirect(url);
    }

    if (onboarded && pathname === "/") {
      const url = new URL("/menu", request.url);
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (isAuthenticated) {
    const payload = Buffer.from(
      JSON.stringify({
        session,
        onboarded,
      })
    ).toString("base64url");
    requestHeaders.set("x-feel-session", payload);
  } else {
    requestHeaders.delete("x-feel-session");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
