import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { CartView } from "@/components/cart/cart-view";
import { PhoneEditModal } from "@/components/menu/phone-edit-modal";
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
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10 sm:px-8 lg:px-10">
          <header className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              {cartDictionary.header.subtitle}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-semibold text-slate-900">
                {cartDictionary.header.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-600">
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
