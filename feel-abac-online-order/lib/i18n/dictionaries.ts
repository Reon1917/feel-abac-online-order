import landingEn from "@/dictionaries/en/landing.json";
import menuEn from "@/dictionaries/en/menu.json";
import cartEn from "@/dictionaries/en/cart.json";
import adminDashboardEn from "@/dictionaries/en/admin-dashboard.json";
import adminMenuEn from "@/dictionaries/en/admin-menu.json";
import adminDeliveryEn from "@/dictionaries/en/admin-delivery.json";
import adminOrdersEn from "@/dictionaries/en/admin-orders.json";
import adminPromptpayEn from "@/dictionaries/en/admin-promptpay.json";
import commonEn from "@/dictionaries/en/common.json";
import orderEn from "@/dictionaries/en/order.json";
import profileEn from "@/dictionaries/en/profile.json";
import authEn from "@/dictionaries/en/auth.json";

import landingMy from "@/dictionaries/my/landing.json";
import menuMy from "@/dictionaries/my/menu.json";
import cartMy from "@/dictionaries/my/cart.json";
import adminDashboardMy from "@/dictionaries/my/admin-dashboard.json";
import adminMenuMy from "@/dictionaries/my/admin-menu.json";
import adminDeliveryMy from "@/dictionaries/my/admin-delivery.json";
import adminOrdersMy from "@/dictionaries/my/admin-orders.json";
import adminPromptpayMy from "@/dictionaries/my/admin-promptpay.json";
import commonMy from "@/dictionaries/my/common.json";
import orderMy from "@/dictionaries/my/order.json";
import profileMy from "@/dictionaries/my/profile.json";
import authMy from "@/dictionaries/my/auth.json";

import type { Locale } from "./config";

export const DICTIONARIES = {
  en: {
    landing: landingEn,
    menu: menuEn,
    cart: cartEn,
    adminDashboard: adminDashboardEn,
    adminMenu: adminMenuEn,
    adminDelivery: adminDeliveryEn,
    adminOrders: adminOrdersEn,
    adminPromptpay: adminPromptpayEn,
    common: commonEn,
    order: orderEn,
    profile: profileEn,
    auth: authEn,
  },
  my: {
    landing: landingMy,
    menu: menuMy,
    cart: cartMy,
    adminDashboard: adminDashboardMy,
    adminMenu: adminMenuMy,
    adminDelivery: adminDeliveryMy,
    adminOrders: adminOrdersMy,
    adminPromptpay: adminPromptpayMy,
    common: commonMy,
    order: orderMy,
    profile: profileMy,
    auth: authMy,
  },
} as const;

export type Surface = keyof typeof DICTIONARIES.en;

export function getDictionary<S extends Surface>(
  locale: Locale,
  surface: S
): typeof DICTIONARIES.en[S] {
  return DICTIONARIES[locale][surface];
}
