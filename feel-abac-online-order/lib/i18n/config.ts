export const SUPPORTED_LOCALES = ["en", "my"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE_NAME = "locale";

export const MENU_LOCALE_COOKIE_NAME = "menuLocale";

