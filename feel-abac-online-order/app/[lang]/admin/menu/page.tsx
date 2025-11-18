import { Suspense } from "react";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AdminMenuManager } from "@/components/admin/menu/menu-manager";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { Button } from "@/components/ui/button";
import { withLocalePath } from "@/lib/i18n/path";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminMenuPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");

  await requireActiveAdmin();

  const menu = await getAdminMenuHierarchy();
  const totalCategories = menu.length;
  const hiddenCategories = menu.filter((category) => !category.isActive).length;
  const totalItems = menu.reduce((sum, category) => sum + category.items.length, 0);
  const publishedItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status === "published").length,
    0
  );
  const draftItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status !== "published").length,
    0
  );
  const unavailableItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => !item.isAvailable).length,
    0
  );

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  const stats = [
    {
      label: dict.stats.categories.label,
      value: totalCategories,
      detail:
        hiddenCategories === 0
          ? dict.stats.categories.allVisible
          : dict.stats.categories.hidden.replace("%s", formatNumber(hiddenCategories)),
    },
    {
      label: dict.stats.menuItems.label,
      value: totalItems,
      detail:
        unavailableItems === 0
          ? dict.stats.menuItems.allAvailable
          : dict.stats.menuItems.unavailable.replace("%s", formatNumber(unavailableItems)),
    },
    {
      label: dict.stats.published.label,
      value: publishedItems,
      detail:
        publishedItems === 0 ? dict.stats.published.nothingLive : dict.stats.published.liveForDiners,
    },
    {
      label: dict.stats.drafts.label,
      value: draftItems,
      detail:
        draftItems === 0
          ? dict.stats.drafts.nothingPending
          : dict.stats.drafts.awaitingReview.replace("%s", formatNumber(draftItems)),
    },
  ];

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
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-6 py-12 lg:px-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.header.workspaceLabel}
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                {dict.header.title}
              </h1>
              <p className="max-w-3xl text-sm text-slate-600">
                {dict.header.subtitle}
              </p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                {dict.header.publishChecklist.title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {dict.header.publishChecklist.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/menu/layout")}>
                {dict.actions?.openLayoutEditor ?? "Open layout editor"}
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatNumber(stat.value)}
                </p>
                <p className="text-xs text-slate-500">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

  <section className="mx-auto -mt-8 w-full max-w-[1360px] px-6 pb-16 lg:px-12">
        <AdminMenuManager initialMenu={menu} variant="workspace" />
      </section>
    </main>
    </>
  );
}
