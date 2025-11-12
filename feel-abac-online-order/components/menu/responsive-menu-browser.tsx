"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MenuBrowser } from "./menu-browser";
import { MobileMenuBrowser } from "./mobile";
import { CartPeekButton } from "./cart-peek-button";
import { useQuickAddToCart, canQuickAddItem } from "./use-quick-add";
import { useCartAddAnimation } from "./cart-add-animation";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";
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
  const router = useRouter();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { quickAdd } = useQuickAddToCart({
    messages: {
      success: dictionary.quickAdd?.success ?? "Added to your cart.",
      error: dictionary.quickAdd?.error ?? "Couldn't add this item. Try again.",
    },
  });
  const { launch, Overlay: CartAddAnimationOverlay } = useCartAddAnimation();

  const handleQuickAdd = useCallback(
    async ({
      item,
      rect,
      detailHref,
    }: {
      item: PublicMenuItem;
      rect?: DOMRect | null;
      detailHref: string;
    }) => {
      if (!item.isAvailable) {
        return;
      }

      if (!canQuickAddItem(item)) {
        router.push(detailHref);
        return;
      }

      const result = await quickAdd(item);
      if (result.status === "added" && rect) {
        launch(rect);
      }
    },
    [launch, quickAdd, router]
  );

  return (
    <>
      {isMobile ? (
        <MobileMenuBrowser
          categories={categories}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
          onQuickAdd={handleQuickAdd}
        />
      ) : (
        <MenuBrowser
          categories={categories}
          layout={layout}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
          onQuickAdd={handleQuickAdd}
        />
      )}
      <CartPeekButton
        summary={cartSummary}
        dictionary={dictionary.cartPeek}
        cartHref={cartHref}
      />
      <CartAddAnimationOverlay />
    </>
  );
}
