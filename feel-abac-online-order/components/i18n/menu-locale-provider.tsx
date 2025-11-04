"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";

export type MenuLocaleValue = {
  menuLocale: Locale;
  setMenuLocale: (next: Locale) => void;
};

const MenuLocaleContext = createContext<MenuLocaleValue | undefined>(undefined);

export function MenuLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [menuLocale, setMenuLocale] = useState<Locale>(initialLocale);

  const value = useMemo<MenuLocaleValue>(
    () => ({ menuLocale, setMenuLocale }),
    [menuLocale]
  );

  return (
    <MenuLocaleContext.Provider value={value}>
      {children}
    </MenuLocaleContext.Provider>
  );
}

export function useMenuLocale() {
  const context = useContext(MenuLocaleContext);
  if (!context) {
    throw new Error("useMenuLocale must be used within a MenuLocaleProvider");
  }
  return context;
}
