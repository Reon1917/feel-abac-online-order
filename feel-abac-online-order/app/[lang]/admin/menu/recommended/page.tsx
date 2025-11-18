import { Suspense } from "react";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getAdminRecommendedMenuItems } from "@/lib/menu/recommendations";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { withLocalePath } from "@/lib/i18n/path";
import { Button } from "@/components/ui/button";
import { RecommendedItemsCard } from "@/components/admin/menu/recommended-items-card";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminRecommendedMenuPage({
  params,
}: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");

  await requireActiveAdmin();

  const [menu, recommended] = await Promise.all([
    getAdminMenuHierarchy(),
    getAdminRecommendedMenuItems(),
  ]);

  const featuredCount = recommended.length;

  return (
    <>
      <nav className="flex items-center justify-end bg-white px-6 py-4 text-slate-900 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher
            locale={locale}
            labels={common.languageSwitcher}
          />
        </Suspense>
      </nav>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <section className="border-b border-slate-200 bg-linear-to-r from-white via-emerald-50 to-white">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-12 lg:px-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {dict.recommendationsPage?.badge ??
                    "Recommended spotlight"}
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                  {dict.recommendationsPage?.title ??
                    "Curate recommended dishes"}
                </h1>
                <p className="max-w-3xl text-sm text-slate-600">
                  {dict.recommendationsPage?.subtitle ??
                    "Pick a handful of dishes to pin above the diner menu. Updates are live as soon as you save."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Link href={withLocalePath(locale, "/admin/menu")}>
                    {dict.recommendationsPage?.buttons?.back ??
                      "Back to builder"}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-slate-700 hover:bg-white/80"
                >
                  <Link href={withLocalePath(locale, "/admin/menu/layout")}>
                    {dict.recommendationsPage?.buttons?.layout ??
                      "Open layout editor"}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {dict.recommendationsPage?.stats?.label ??
                    "Featured items"}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {featuredCount}
                </p>
                <p>
                  {dict.recommendationsPage?.stats?.description ??
                    "Pinned cards appear at the very top of the diner experience."}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto -mt-8 w-full max-w-[1200px] px-6 pb-16 lg:px-12">
          <RecommendedItemsCard
            menu={menu}
            initialRecommendations={recommended}
            dictionary={dict.recommendationsManager}
          />
        </section>
      </main>
    </>
  );
}
