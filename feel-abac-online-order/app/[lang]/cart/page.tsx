import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { CartView } from "@/components/cart/cart-view";
import { PhoneEditModal } from "@/components/menu/phone-edit-modal";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { getActiveCartForUser } from "@/lib/cart/queries";

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
  const commonDictionary = getDictionary(locale, "common");

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(sessionData.session.user.id);
  if (!profile) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  const cart = await getActiveCartForUser(sessionData.session.user.id);
  const menuHref = withLocalePath(locale, "/menu");

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <nav className="flex items-center justify-end bg-white px-6 py-4 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher
            locale={locale}
            labels={commonDictionary.languageSwitcher}
          />
        </Suspense>
      </nav>
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
          <header className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">
              {cartDictionary.header.subtitle}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-semibold text-slate-900">
                {cartDictionary.header.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>{profile.phoneNumber}</span>
                <PhoneEditModal currentPhone={profile.phoneNumber} />
              </div>
            </div>
          </header>

          <CartView cart={cart} dictionary={cartDictionary} menuHref={menuHref} />
        </div>
      </main>
    </>
  );
}
