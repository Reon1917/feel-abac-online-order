"use client";

import { useEffect, useState } from "react";

import { MenuBrowser } from "./menu-browser";
import { MobileMenuBrowser } from "./mobile";
import { PublicMenuCategory } from "@/lib/menu/types";

type ResponsiveMenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
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

export function ResponsiveMenuBrowser({ categories, layout }: ResponsiveMenuBrowserProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return <MobileMenuBrowser categories={categories} />;
  }

  return <MenuBrowser categories={categories} layout={layout} />;
}

