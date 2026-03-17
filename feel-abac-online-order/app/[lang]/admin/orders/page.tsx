import { unstable_noStore as noStore } from "next/cache";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { OrderListClient } from "@/components/admin/orders/order-list-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { getTodayOrdersForAdmin } from "@/lib/orders/queries";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminOrdersPage({ params }: PageProps) {
  noStore();
  const { lang } = await params;
  const locale = lang as Locale;

  const dictionary = getDictionary(locale, "adminOrders");
  const common = getDictionary(locale, "common");
  const orders = await getTodayOrdersForAdmin();

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.pageTitle}
        subtitle={dictionary.todayListTitle ?? dictionary.listTitle}
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            <MenuLanguageToggle
              labels={{
                label: dictionary.menuLanguageLabel ?? "Menu language",
                english: dictionary.menuLanguageEnglish ?? "English names",
                burmese: dictionary.menuLanguageBurmese ?? "Burmese names",
              }}
              hideLabel
            />
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <div>
          <OrderListClient initialOrders={orders} dictionary={dictionary} />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
