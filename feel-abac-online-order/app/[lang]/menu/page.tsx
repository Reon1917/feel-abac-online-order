import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminBar } from "@/components/admin/admin-bar";
import { ResponsiveMenuBrowser } from "@/components/menu/responsive-menu-browser";
import { PhoneEditModal } from "@/components/menu/phone-edit-modal";
import { getPublicMenuHierarchy } from "@/lib/menu/queries";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { getActiveCartSummary } from "@/lib/cart/queries";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function MenuPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "menu");
  const common = getDictionary(locale, "common");

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(sessionData.session.user.id);
  if (!profile) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  const menuCategories = await getPublicMenuHierarchy();
  const cartSummary = await getActiveCartSummary(sessionData.session.user.id);
  const hasMenu =
    menuCategories.length > 0 &&
    menuCategories.some((category) => category.items.length > 0);
  const cartHref = withLocalePath(locale, "/cart");

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <nav className="flex items-center justify-end bg-white px-6 py-4 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher
            locale={locale}
            labels={common.languageSwitcher}
          />
        </Suspense>
      </nav>
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-12">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{dict.header.title}</h1>
              <p className="flex items-center gap-1 text-sm text-slate-600">
                {dict.header.description}{" "}
                <strong className="font-semibold text-slate-800">
                  {profile.phoneNumber}
                </strong>
                <PhoneEditModal currentPhone={profile.phoneNumber} />
              </p>
            </div>
            <SignOutButton />
          </header>

          {hasMenu ? (
            <ResponsiveMenuBrowser
              categories={menuCategories}
              dictionary={dict}
              common={common}
              appLocale={locale}
              cartSummary={cartSummary}
              cartHref={cartHref}
            />
          ) : (
            <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                {dict.emptyState.heading}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{dict.emptyState.body}</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
