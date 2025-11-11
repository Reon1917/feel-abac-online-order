import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { MenuLayoutEditor } from "@/components/admin/menu/menu-layout-editor";
import { withLocalePath } from "@/lib/i18n/path";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function MenuLayoutEditorPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;

  await requireActiveAdmin();

  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");
  const menu = await getAdminMenuHierarchy();

  return (
    <>
      <nav className="flex items-center justify-between bg-white px-6 py-4 text-slate-900 sm:px-10 lg:px-12">
        <Button asChild variant="ghost" size="sm">
          <Link href={withLocalePath(locale, "/admin/menu")}>← {dict.layoutEditor.backToBuilder}</Link>
        </Button>
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
        </Suspense>
      </nav>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <section className="border-b border-slate-200 bg-linear-to-r from-white via-emerald-50 to-white">
          <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-6 py-12 lg:px-12">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.header.workspaceLabel}
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                {dict.layoutEditor.title}
              </h1>
              <p className="max-w-3xl text-sm text-slate-600">{dict.layoutEditor.subtitle}</p>
            </div>
          </div>
        </section>
        <section className="mx-auto -mt-8 w-full max-w-[1360px] px-6 pb-16 lg:px-12">
          <MenuLayoutEditor initialMenu={menu} labels={dict.layoutEditor} />
        </section>
      </main>
    </>
  );
}
