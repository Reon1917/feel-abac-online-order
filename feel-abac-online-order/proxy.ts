import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";

import { auth } from "./lib/auth";
import { db } from "./src/db/client";
import { userProfiles } from "./src/db/schema";
import { getAdminByUserId } from "./lib/admin";
import {
  LOCALE_COOKIE_NAME,
  MENU_LOCALE_COOKIE_NAME,
  type Locale,
} from "./lib/i18n/config";
import {
  addLocaleToPath,
  extractLocaleFromPath,
  mapToSupportedLocale,
  negotiateLocale,
  parseAcceptLanguage,
} from "./lib/i18n/utils";

const PROTECTED_PATHS = new Set(["/menu", "/onboarding", "/admin"]);
const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

async function resolveSession(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
      asResponse: false,
      returnHeaders: false,
    });
    return session;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("proxy session error", error);
    }
    return null;
  }
}

async function hasCompletedOnboarding(userId: string) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  return !!profile?.phoneNumber && !!profile?.deliverySelectionMode;
}

function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, COOKIE_OPTIONS);
}

function redirectTo(
  request: NextRequest,
  locale: Locale,
  pathname: string
): NextResponse {
  const url = new URL(request.url);
  url.pathname = addLocaleToPath(pathname, locale);
  const response = NextResponse.redirect(url);
  setLocaleCookie(response, locale);
  return response;
}

function pathRequiresAuth(pathname: string) {
  if (PROTECTED_PATHS.has(pathname)) {
    return true;
  }
  for (const entry of PROTECTED_PATHS) {
    if (pathname.startsWith(`${entry}/`)) {
      return true;
    }
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");

  const headerList = request.headers;
  const cookieLocale = mapToSupportedLocale(
    request.cookies.get(LOCALE_COOKIE_NAME)?.value
  );
  const headerLocales = parseAcceptLanguage(headerList.get("accept-language"));
  const negotiatedLocale = negotiateLocale(headerLocales);

  let locale: Locale = cookieLocale ?? negotiatedLocale;
  let normalizedPathname = pathname;
  let shouldPersistLocale = false;

  if (!isApiRoute) {
    const { locale: pathLocale, pathWithoutLocale } = extractLocaleFromPath(
      pathname
    );

    if (!pathLocale) {
      return redirectTo(request, locale, pathname);
    }

    locale = pathLocale;
    normalizedPathname = pathWithoutLocale;

    if (!cookieLocale || cookieLocale !== locale) {
      shouldPersistLocale = true;
    }
  }

  const session = await resolveSession(request);
  const isAuthenticated = !!session?.user;

  let onboarded = false;
  let isAdmin = false;
  let adminRole: string | null = null;

  if (isAuthenticated) {
    const [hasOnboarded, admin] = await Promise.all([
      hasCompletedOnboarding(session.user.id),
      getAdminByUserId(session.user.id),
    ]);
    onboarded = hasOnboarded;
    isAdmin = !!admin?.isActive;
    adminRole = admin?.isActive ? admin.role : null;
  }

  if (!isApiRoute) {
    const requiresAuth = pathRequiresAuth(normalizedPathname);

    if (!isAuthenticated && requiresAuth) {
      return redirectTo(request, locale, "/");
    }

    if (normalizedPathname.startsWith("/admin") && !isAdmin) {
      return redirectTo(request, locale, "/");
    }

    if (isAuthenticated) {
      if (isAdmin && onboarded && normalizedPathname === "/") {
        return redirectTo(request, locale, "/admin/dashboard");
      }

      if (
        !onboarded &&
        normalizedPathname !== "/onboarding" &&
        normalizedPathname !== "/admin/dashboard"
      ) {
        return redirectTo(request, locale, "/onboarding");
      }

      if (onboarded && normalizedPathname === "/onboarding") {
        return redirectTo(
          request,
          locale,
          isAdmin ? "/admin/dashboard" : "/menu"
        );
      }

      if (onboarded && normalizedPathname === "/" && !isAdmin) {
        return redirectTo(request, locale, "/menu");
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (isAuthenticated) {
    const payload = Buffer.from(
      JSON.stringify({
        session,
        onboarded,
        isAdmin,
        adminRole,
      })
    ).toString("base64url");
    requestHeaders.set("x-feel-session", payload);
  } else {
    requestHeaders.delete("x-feel-session");
  }
  requestHeaders.set("x-feel-locale", locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!isApiRoute && shouldPersistLocale) {
    setLocaleCookie(response, locale);
  }

  if (!isApiRoute && !request.cookies.get(MENU_LOCALE_COOKIE_NAME)) {
    response.cookies.set(MENU_LOCALE_COOKIE_NAME, locale, COOKIE_OPTIONS);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
