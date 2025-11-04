import landingEn from "@/dictionaries/en/landing.json";
import menuEn from "@/dictionaries/en/menu.json";
import adminDashboardEn from "@/dictionaries/en/admin-dashboard.json";
import adminMenuEn from "@/dictionaries/en/admin-menu.json";
import commonEn from "@/dictionaries/en/common.json";

import landingMy from "@/dictionaries/my/landing.json";
import menuMy from "@/dictionaries/my/menu.json";
import adminDashboardMy from "@/dictionaries/my/admin-dashboard.json";
import adminMenuMy from "@/dictionaries/my/admin-menu.json";
import commonMy from "@/dictionaries/my/common.json";

import type { Locale } from "./config";

export const DICTIONARIES = {
  en: {
    landing: landingEn,
    menu: menuEn,
    adminDashboard: adminDashboardEn,
    adminMenu: adminMenuEn,
    common: commonEn,
  },
  my: {
    landing: landingMy,
    menu: menuMy,
    adminDashboard: adminDashboardMy,
    adminMenu: adminMenuMy,
    common: commonMy,
  },
} as const;

export type Surface = keyof typeof DICTIONARIES.en;

export function getDictionary<S extends Surface>(
  locale: Locale,
  surface: S
): typeof DICTIONARIES.en[S] {
  return DICTIONARIES[locale][surface];
}
