import landingEn from "@/dictionaries/en/landing.json";
import menuEn from "@/dictionaries/en/menu.json";
import cartEn from "@/dictionaries/en/cart.json";
import adminDashboardEn from "@/dictionaries/en/admin-dashboard.json";
import adminMenuEn from "@/dictionaries/en/admin-menu.json";
import adminDeliveryEn from "@/dictionaries/en/admin-delivery.json";
import commonEn from "@/dictionaries/en/common.json";
import orderEn from "@/dictionaries/en/order.json";

import landingMy from "@/dictionaries/my/landing.json";
import menuMy from "@/dictionaries/my/menu.json";
import cartMy from "@/dictionaries/my/cart.json";
import adminDashboardMy from "@/dictionaries/my/admin-dashboard.json";
import adminMenuMy from "@/dictionaries/my/admin-menu.json";
import adminDeliveryMy from "@/dictionaries/my/admin-delivery.json";
import commonMy from "@/dictionaries/my/common.json";
import orderMy from "@/dictionaries/my/order.json";

import type { Locale } from "./config";

export const DICTIONARIES = {
  en: {
    landing: landingEn,
    menu: menuEn,
    cart: cartEn,
    adminDashboard: adminDashboardEn,
    adminMenu: adminMenuEn,
    adminDelivery: adminDeliveryEn,
    common: commonEn,
    order: orderEn,
  },
  my: {
    landing: landingMy,
    menu: menuMy,
    cart: cartMy,
    adminDashboard: adminDashboardMy,
    adminMenu: adminMenuMy,
    adminDelivery: adminDeliveryMy,
    common: commonMy,
    order: orderMy,
  },
} as const;

export type Surface = keyof typeof DICTIONARIES.en;

export function getDictionary<S extends Surface>(
  locale: Locale,
  surface: S
): typeof DICTIONARIES.en[S] {
  return DICTIONARIES[locale][surface];
}
