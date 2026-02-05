"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MenuBrowser } from "./menu-browser";
import { MobileMenuBrowser } from "./mobile";
import { CartPeekButton } from "./cart-peek-button";
import { useQuickAddToCart, canQuickAddItem } from "./use-quick-add";
import { useCartAddAnimation } from "./cart-add-animation";
import {
  PublicMenuCategory,
  PublicMenuItem,
  PublicRecommendedMenuItem,
} from "@/lib/menu/types";
import type { Locale } from "@/lib/i18n/config";
import type { CartSummary } from "@/lib/cart/types";
import { MenuImageCacheProvider } from "./menu-image-cache";
import {
  clearMenuReturnState,
  consumeMenuRefreshFlag,
  rememberMenuScrollPosition,
  restoreMenuScrollPosition,
} from "./menu-scroll";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type ResponsiveMenuBrowserProps = {
  categories: PublicMenuCategory[];
  recommendedItems?: PublicRecommendedMenuItem[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
  appLocale: Locale;
  cartSummary: CartSummary | null;
  cartHref: string;
  isAdmin?: boolean;
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
  recommendedItems = [],
  layout,
  dictionary,
  common,
  appLocale,
  cartSummary,
  cartHref,
  isAdmin = false,
}: ResponsiveMenuBrowserProps) {
  const router = useRouter();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [optimisticTotals, setOptimisticTotals] = useState({
    quantity: 0,
    subtotal: 0,
  });
  const { quickAdd } = useQuickAddToCart({
    messages: {
      error: dictionary.quickAdd?.error ?? "Couldn't add this item. Try again.",
      activeOrderBlock: dictionary.activeOrderBlock
        ? {
            message: dictionary.activeOrderBlock.message,
            cta: dictionary.activeOrderBlock.cta ?? "View order",
            locale: appLocale,
          }
        : undefined,
    },
  });
  const { launch, Overlay: CartAddAnimationOverlay } = useCartAddAnimation();

  useLayoutEffect(() => {
    restoreMenuScrollPosition(appLocale);
    if (consumeMenuRefreshFlag(appLocale)) {
      router.refresh();
    }
    clearMenuReturnState(appLocale);
  }, [appLocale, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticTotals((prev) => {
      if (prev.quantity === 0 && prev.subtotal === 0) {
        return prev;
      }
      return { quantity: 0, subtotal: 0 };
    });
  }, [cartSummary?.subtotal, cartSummary?.totalQuantity]);

  const applyOptimisticDelta = useCallback(
    (quantityDelta: number, subtotalDelta: number) => {
      setOptimisticTotals((prev) => ({
        quantity: Math.max(0, prev.quantity + quantityDelta),
        subtotal: Math.max(0, prev.subtotal + subtotalDelta),
      }));
    },
    []
  );

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
        rememberMenuScrollPosition(appLocale);
        router.push(detailHref);
        return;
      }

      const quantityDelta = 1;
      const subtotalDelta = item.price;

      const result = await quickAdd(item);
      if (result.status === "added") {
        applyOptimisticDelta(quantityDelta, subtotalDelta);
        if (rect) {
          launch(rect);
        }
      }
    },
    [appLocale, applyOptimisticDelta, launch, quickAdd, router]
  );

  return (
    <MenuImageCacheProvider>
      {isMobile ? (
        <MobileMenuBrowser
          categories={categories}
          recommended={recommendedItems}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
          onQuickAdd={handleQuickAdd}
          isAdmin={isAdmin}
        />
      ) : (
        <MenuBrowser
          categories={categories}
          recommended={recommendedItems}
          layout={layout}
          dictionary={dictionary}
          common={common}
          appLocale={appLocale}
          onQuickAdd={handleQuickAdd}
        />
      )}
      {/* Desktop-only floating cart button (hidden on mobile since bottom nav has cart) */}
      <div className="hidden sm:block">
        <CartPeekButton
          summary={cartSummary}
          dictionary={dictionary.cartPeek}
          cartHref={cartHref}
          optimisticQuantity={optimisticTotals.quantity}
          optimisticSubtotal={optimisticTotals.subtotal}
        />
      </div>
      <CartAddAnimationOverlay />
    </MenuImageCacheProvider>
  );
}
