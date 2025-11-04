import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./config";

function toLowerSafe(value: string | null | undefined) {
  return value ? value.toLowerCase() : value;
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value as Locale);
}

export function mapToSupportedLocale(value: string | null | undefined): Locale | null {
  const normalized = toLowerSafe(value);
  if (!normalized) return null;

  if (isSupportedLocale(normalized)) {
    return normalized;
  }

  const base = normalized.split("-")[0] ?? normalized;
  return isSupportedLocale(base) ? (base as Locale) : null;
}

type ParsedLanguage = {
  tag: string;
  quality: number;
};

function parseLanguagePart(part: string): ParsedLanguage | null {
  const [tagPart, ...params] = part.trim().split(";");
  if (!tagPart) return null;

  let quality = 1;
  for (const param of params) {
    const [key, value] = param.trim().split("=");
    if (key === "q") {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        quality = parsed;
      }
    }
  }

  return { tag: tagPart.toLowerCase(), quality };
}

export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map(parseLanguagePart)
    .filter((entry): entry is ParsedLanguage => Boolean(entry?.tag))
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}

export function negotiateLocale(preferred: string[]): Locale {
  for (const tag of preferred) {
    const matched = mapToSupportedLocale(tag);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

export function extractLocaleFromPath(pathname: string): {
  locale: Locale | null;
  pathWithoutLocale: string;
} {
  const segments = pathname.split("/");
  const leading = segments[1];
  const matched = mapToSupportedLocale(leading);
  if (!matched) {
    return {
      locale: null,
      pathWithoutLocale: pathname || "/",
    };
  }

  const restSegments = segments.slice(2);
  const restPath = restSegments.length ? `/${restSegments.join("/")}` : "/";

  return {
    locale: matched,
    pathWithoutLocale: restPath,
  };
}

export function addLocaleToPath(pathname: string, locale: Locale): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (normalizedPath === "/") {
    return `/${locale}`;
  }

  const withoutSlash = normalizedPath.replace(/^\/+/, "");
  return `/${locale}/${withoutSlash}`;
}
