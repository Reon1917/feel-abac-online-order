"use client";

import { useEffect, useState } from "react";

import { MenuBrowser } from "./menu-browser";
import { MobileMenuBrowser } from "./mobile";
import { PublicMenuCategory } from "@/lib/menu/types";
import type { Locale } from "@/lib/i18n/config";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type ResponsiveMenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
  appLocale: Locale;
};

const MOBILE_QUERY = "(max-width: 640px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    const updateMatch = () => setMatches(mediaQuery.matches);

    queueMicrotask(updateMatch);
    mediaQuery.addEventListener("change", updateMatch);

    return () => {
      mediaQuery.removeEventListener("change", updateMatch);
    };
  }, [query]);

  return matches;
}

export function ResponsiveMenuBrowser({
  categories,
  layout,
  dictionary,
  common,
  appLocale,
}: ResponsiveMenuBrowserProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return (
      <MobileMenuBrowser
        categories={categories}
        dictionary={dictionary}
        common={common}
        appLocale={appLocale}
      />
    );
  }

  return (
    <MenuBrowser
      categories={categories}
      layout={layout}
      dictionary={dictionary}
      common={common}
      appLocale={appLocale}
    />
  );
}
