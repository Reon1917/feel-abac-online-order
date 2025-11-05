import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminBar } from "@/components/admin/admin-bar";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { MenuItemDetail } from "@/components/menu/menu-item-detail";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getPublicMenuItemById } from "@/lib/menu/queries";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type PageParams = {
  params: Promise<{
    lang: string;
    itemId: string;
  }>;
};

export default async function MenuItemDetailPage({ params }: PageParams) {
  noStore();

  const { lang, itemId } = await params;
  const locale = lang as Locale;

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const userId = sessionData.session.user.id;
  const profile = await getUserProfile(userId);
  if (!profile) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  const dictionary = getDictionary(locale, "menu");
  const common = getDictionary(locale, "common");

  const result = await getPublicMenuItemById(itemId);
  if (!result) {
    notFound();
  }

  const backHref = withLocalePath(locale, "/menu");

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <nav className="flex items-center justify-end bg-white px-6 py-4 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
        </Suspense>
      </nav>

      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-12">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {dictionary.detail.back}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <MenuLanguageToggle
                labels={common.menuLanguageToggle}
                className="w-full max-w-xs"
              />
              <SignOutButton />
            </div>
          </header>

          <MenuItemDetail
            item={result.item}
            category={{ name: result.category.name, nameMm: result.category.nameMm }}
            detail={dictionary.detail}
          />
        </div>
      </main>
    </>
  );
}
