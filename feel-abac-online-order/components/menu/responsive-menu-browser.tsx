"use client";

import { useEffect, useState } from "react";

import { MenuBrowser } from "./menu-browser";
import { MobileMenuBrowser } from "./mobile";
import { CartPeekButton } from "./cart-peek-button";
import { CartDraftProvider } from "./cart-draft-provider";
import { PublicMenuCategory } from "@/lib/menu/types";
import type { Locale } from "@/lib/i18n/config";
import type { CartSummary } from "@/lib/cart/types";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type ResponsiveMenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
  appLocale: Locale;
  cartSummary: CartSummary | null;
  cartHref: string;
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
  cartSummary,
  cartHref,
}: ResponsiveMenuBrowserProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  return (
    <CartDraftProvider messages={dictionary.cartToasts}>
      {isMobile ? (
        <MobileMenuBrowser
          categories={categories}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
        />
      ) : (
        <MenuBrowser
          categories={categories}
          layout={layout}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
        />
      )}
      <CartPeekButton
        summary={cartSummary}
        dictionary={dictionary.cartPeek}
        cartHref={cartHref}
      />
    </CartDraftProvider>
  );
}
