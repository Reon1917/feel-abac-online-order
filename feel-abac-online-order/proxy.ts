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

function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/static");
  if (isStatic) {
    return NextResponse.next();
  }

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
      const url = request.nextUrl.clone();
      url.pathname = addLocaleToPath(pathname, locale);
      const response = NextResponse.redirect(url);
      setLocaleCookie(response, locale);
      return response;
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

  if (isAuthenticated) {
    onboarded = await hasCompletedOnboarding(session.user.id);
    const admin = await getAdminByUserId(session.user.id);
    isAdmin = !!admin?.isActive;
  }

  if (!isApiRoute) {
    const requiresAuth = AUTH_REQUIRED_PATHS.some(
      (path) =>
        normalizedPathname === path ||
        normalizedPathname.startsWith(`${path}/`)
    );

    if (!isAuthenticated && requiresAuth) {
      const url = new URL(request.url);
      url.pathname = addLocaleToPath("/", locale);
      const response = NextResponse.redirect(url);
      setLocaleCookie(response, locale);
      return response;
    }

    if (normalizedPathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.json(
        { error: "Access forbidden" },
        { status: 403 }
      );
    }

    if (isAuthenticated) {
      if (isAdmin && onboarded && normalizedPathname === "/") {
        const url = new URL(request.url);
        url.pathname = addLocaleToPath("/admin/dashboard", locale);
        const response = NextResponse.redirect(url);
        setLocaleCookie(response, locale);
        return response;
      }

      if (
        !onboarded &&
        normalizedPathname !== "/onboarding" &&
        normalizedPathname !== "/admin/dashboard"
      ) {
        const url = new URL(request.url);
        url.pathname = addLocaleToPath("/onboarding", locale);
        const response = NextResponse.redirect(url);
        setLocaleCookie(response, locale);
        return response;
      }

      if (onboarded && normalizedPathname === "/onboarding") {
        const url = new URL(request.url);
        url.pathname = addLocaleToPath(
          isAdmin ? "/admin/dashboard" : "/menu",
          locale
        );
        const response = NextResponse.redirect(url);
        setLocaleCookie(response, locale);
        return response;
      }

      if (onboarded && normalizedPathname === "/" && !isAdmin) {
        const url = new URL(request.url);
        url.pathname = addLocaleToPath("/menu", locale);
        const response = NextResponse.redirect(url);
        setLocaleCookie(response, locale);
        return response;
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

  if (!request.cookies.get(MENU_LOCALE_COOKIE_NAME)) {
    response.cookies.set(MENU_LOCALE_COOKIE_NAME, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
