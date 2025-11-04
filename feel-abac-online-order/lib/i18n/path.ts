import type { Locale } from "./config";
import { SUPPORTED_LOCALES } from "./config";

export function withLocalePath(locale: Locale, pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}

export function swapLocaleInPath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return `/${nextLocale}`;
  }
  if (SUPPORTED_LOCALES.includes(segments[0] as Locale)) {
    const rest = segments.slice(1).join("/");
    return rest ? `/${nextLocale}/${rest}` : `/${nextLocale}`;
  }
  return withLocalePath(nextLocale, `/${segments.join("/")}`);
}

