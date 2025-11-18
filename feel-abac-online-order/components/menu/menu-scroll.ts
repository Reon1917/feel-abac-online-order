import type { Locale } from "@/lib/i18n/config";

const STORAGE_PREFIX = "menu:scroll:";
const RETURN_PREFIX = "menu:return:";
const REFRESH_FLAG_PREFIX = "menu:return-refresh:";

function safeSetItem(key: string, value: string) {
  try {
    if (typeof sessionStorage === "undefined") {
      return;
    }
    sessionStorage.setItem(key, value);
  } catch {
    // ignored – storage may be unavailable
  }
}

function safeGetItem(key: string) {
  try {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(key: string) {
  try {
    if (typeof sessionStorage === "undefined") {
      return;
    }
    sessionStorage.removeItem(key);
  } catch {
    // ignored
  }
}

function storageKey(locale: Locale) {
  return `${STORAGE_PREFIX}${locale}`;
}

function returnKey(locale: Locale) {
  return `${RETURN_PREFIX}${locale}`;
}

function refreshKey(locale: Locale) {
  return `${REFRESH_FLAG_PREFIX}${locale}`;
}

export function rememberMenuScrollPosition(locale: Locale) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  const key = storageKey(locale);
  const offset =
    typeof window.scrollY === "number"
      ? window.scrollY
      : (document.documentElement?.scrollTop ?? 0);
  safeSetItem(key, String(offset));
  safeSetItem(returnKey(locale), "1");
}

export function restoreMenuScrollPosition(locale: Locale) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  const key = storageKey(locale);
  const value = safeGetItem(key);
  if (!value) {
    return;
  }
  safeRemoveItem(key);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return;
  }
  window.scrollTo({
    top: parsed,
    behavior: "auto",
  });
}

export function consumeMenuReturnFlag(locale: Locale) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }
  const key = returnKey(locale);
  const hasFlag = safeGetItem(key);
  if (hasFlag) {
    safeRemoveItem(key);
    return true;
  }
  return false;
}

export function markMenuNeedsRefresh(locale: Locale) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  safeSetItem(refreshKey(locale), "1");
}

export function consumeMenuRefreshFlag(locale: Locale) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }
  const key = refreshKey(locale);
  const hasFlag = safeGetItem(key);
  if (hasFlag) {
    safeRemoveItem(key);
    return true;
  }
  return false;
}
