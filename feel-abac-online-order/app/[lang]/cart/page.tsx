import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { CartView } from "@/components/cart/cart-view";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getSession } from "@/lib/session";
import {
  getUserProfile,
  buildDeliverySelectionFromProfile,
  buildCustomSelectionFromProfile,
} from "@/lib/user-profile";
import { getActiveCartForUser } from "@/lib/cart/queries";
import { getActiveDeliveryLocations } from "@/lib/delivery/queries";
import type { DeliverySelection } from "@/lib/delivery/types";
import { MobileBottomNav } from "@/components/menu/mobile-bottom-nav";
import { getShopStatus } from "@/lib/shop/queries";
import { ShopClosedOverlay } from "@/components/shop/shop-closed-overlay";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function CartPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const cartDictionary = getDictionary(locale, "cart");
  const common = getDictionary(locale, "common");

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(sessionData.session.user.id);
  if (!profile) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  const shopStatus = await getShopStatus();
  if (!shopStatus.isOpen) {
    return (
      <>
        {sessionData.isAdmin && <AdminBar />}
        <ShopClosedOverlay
          messageEn={shopStatus.closedMessageEn}
          messageMm={shopStatus.closedMessageMm}
        />
      </>
    );
  }

  const cart = await getActiveCartForUser(sessionData.session.user.id);
  const deliveryLocations = await getActiveDeliveryLocations();
  const menuHref = withLocalePath(locale, "/menu");
  const defaultDeliverySelection: DeliverySelection | null =
    buildDeliverySelectionFromProfile(profile);
  const savedCustomSelection: DeliverySelection | null =
    buildCustomSelectionFromProfile(profile);

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <main className="min-h-screen w-full bg-white pb-20 sm:pb-0 sm:pl-20 lg:pl-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10 sm:px-8 lg:px-10">
          <CartView
            cart={cart}
            dictionary={cartDictionary}
            menuHref={menuHref}
            deliveryLocations={deliveryLocations}
            defaultDeliverySelection={defaultDeliverySelection}
            savedCustomSelection={savedCustomSelection}
            locale={locale}
          />
        </div>
      </main>
      <MobileBottomNav locale={locale} labels={common.mobileNav} />
    </>
  );
}
