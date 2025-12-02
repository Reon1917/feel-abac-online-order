import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AdminBar } from "@/components/admin/admin-bar";
import { ResponsiveMenuBrowser } from "@/components/menu/responsive-menu-browser";
import { getPublicMenuHierarchy } from "@/lib/menu/queries";
import { getPublicRecommendedMenuItems } from "@/lib/menu/recommendations";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { getActiveCartSummary } from "@/lib/cart/queries";
import { ResumeOrderBanner } from "@/components/orders/resume-order-banner";
import { MobileBottomNav } from "@/components/menu/mobile-bottom-nav";

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

  const userId = sessionData.session.user.id;

  const [profile, menuCategories, recommendedItems, cartSummary] = await Promise.all([
    getUserProfile(userId),
    getPublicMenuHierarchy(),
    getPublicRecommendedMenuItems(),
    getActiveCartSummary(userId),
  ]);

  if (!profile) {
    redirect(withLocalePath(locale, "/onboarding"));
  }
  const hasMenu =
    menuCategories.length > 0 &&
    menuCategories.some((category) => category.items.length > 0);
  const cartHref = withLocalePath(locale, "/cart");

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <main className="min-h-screen w-full bg-white pb-20 sm:pb-0 sm:pl-20 lg:pl-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{dict.header.title}</h1>
              <p className="text-sm text-slate-600">{dict.header.description}</p>
            </div>
          </header>

          <ResumeOrderBanner
            locale={locale}
            dictionary={dict.resumeOrder}
          />

          {hasMenu ? (
            <ResponsiveMenuBrowser
              categories={menuCategories}
              recommendedItems={recommendedItems}
              dictionary={dict}
              common={common}
              appLocale={locale}
              cartSummary={cartSummary}
              cartHref={cartHref}
              isAdmin={sessionData.isAdmin}
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
      <MobileBottomNav locale={locale} labels={common.mobileNav} />
    </>
  );
}
