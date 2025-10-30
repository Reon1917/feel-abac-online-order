import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";

import { auth } from "./lib/auth";
import { db } from "./src/db/client";
import { userProfiles } from "./src/db/schema";
import { getAdminByUserId } from "./lib/admin";

const AUTH_REQUIRED_PATHS = ["/menu", "/onboarding", "/admin"];

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
  let isAdmin = false;

  if (isAuthenticated) {
    onboarded = await hasCompletedOnboarding(session.user.id);
    const admin = await getAdminByUserId(session.user.id);
    isAdmin = !!admin?.isActive;

    // Block non-admins from /admin routes
    if (pathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.json(
        { error: "Access forbidden" },
        { status: 403 }
      );
    }

    // Auto-redirect admins to dashboard (unless on customer pages)
    if (isAdmin && onboarded && pathname === "/") {
      const url = new URL("/admin/dashboard", request.url);
      return NextResponse.redirect(url);
    }

    // Regular user onboarding flow
    if (!onboarded && pathname !== "/onboarding" && pathname !== "/admin/dashboard") {
      const url = new URL("/onboarding", request.url);
      return NextResponse.redirect(url);
    }

    if (onboarded && pathname === "/onboarding") {
      const url = new URL(isAdmin ? "/admin/dashboard" : "/menu", request.url);
      return NextResponse.redirect(url);
    }

    if (onboarded && pathname === "/" && !isAdmin) {
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
        isAdmin,
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
