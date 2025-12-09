import { Suspense } from "react";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAllChoicePools } from "@/lib/menu/pool-queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { withLocalePath } from "@/lib/i18n/path";
import { Button } from "@/components/ui/button";
import { PoolManager } from "@/components/admin/menu/pool-manager";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminPoolsPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const common = getDictionary(locale, "common");

  await requireActiveAdmin();

  const pools = await getAllChoicePools();

  const totalPools = pools.length;
  const totalOptions = pools.reduce((sum, pool) => sum + pool.options.length, 0);

  return (
    <>
      <nav className="flex items-center justify-end bg-white px-6 py-4 text-slate-900 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
        </Suspense>
      </nav>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <section className="border-b border-slate-200 bg-gradient-to-r from-white via-emerald-50 to-white">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-12 lg:px-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Set Menu Configuration
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                  Choice Pools
                </h1>
                <p className="max-w-3xl text-sm text-slate-600">
                  Manage reusable option pools for set menus. Each pool can contain curries, vegetables, or other options that customers can select from.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Link href={withLocalePath(locale, "/admin/dashboard")}>
                    Back to dashboard
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-slate-700 hover:bg-white/80"
                >
                  <Link href={withLocalePath(locale, "/admin/menu")}>
                    Menu builder
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Choice Pools
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {totalPools}
                </p>
                <p>
                  Groups of options that can be attached to set menu items.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Total Options
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {totalOptions}
                </p>
                <p>
                  Individual choices across all pools (curries, veggies, etc.).
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto -mt-8 w-full max-w-[1200px] px-6 pb-16 lg:px-12">
          <PoolManager initialPools={pools} />
        </section>
      </main>
    </>
  );
}
