import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminBar } from "@/components/admin/admin-bar";
import { MenuItemDetail } from "@/components/menu/menu-item-detail";
import { BackToMenuLink } from "@/components/menu/back-to-menu-link";
import { getPublicMenuItemById } from "@/lib/menu/queries";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";
import { MobileBottomNav } from "@/components/menu/mobile-bottom-nav";

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
  const normalizedItemId = itemId?.trim();
  if (!normalizedItemId) {
    notFound();
  }

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

  const result = await getPublicMenuItemById(normalizedItemId);
  if (!result) {
    notFound();
  }

  const backHref = withLocalePath(locale, "/menu");

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}

      <main className="min-h-screen w-full bg-white pb-20 sm:pb-0">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-12">
          <header className="flex flex-col items-start gap-4">
            <BackToMenuLink
              href={backHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{dictionary.detail.back}</span>
            </BackToMenuLink>
          </header>

          <MenuItemDetail
            item={result.item}
            category={{ name: result.category.name, nameMm: result.category.nameMm }}
            detail={dictionary.detail}
            locale={locale}
          />
        </div>
      </main>
      <MobileBottomNav locale={locale} labels={common.mobileNav} />
    </>
  );
}
