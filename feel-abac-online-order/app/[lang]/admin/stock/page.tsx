import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { getStockControlData } from "@/lib/menu/stock-queries";
import { StockControlClient } from "./stock-control-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function StockControlPage({ params }: PageProps) {
  const { lang } = await params;

  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(DEFAULT_LOCALE, "/admin/stock"));
  }

  const locale = lang as Locale;
  const common = getDictionary(locale, "common");

  const sessionData = await getSession();

  if (!sessionData?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const { categories, items } = await getStockControlData();

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title="Availability"
        subtitle="Toggle items as available or unavailable"
        languageLabels={common.languageSwitcher}
      />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8">
        <StockControlClient
          initialCategories={categories}
          initialItems={items}
        />
      </div>
    </AdminLayoutShell>
  );
}
