import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { ArchivedOrdersClient } from "@/components/admin/orders/archived-orders-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getArchivedOrdersForAdmin } from "@/lib/orders/queries";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function ArchivedOrdersPage({ params }: PageProps) {
  noStore();
  const { lang } = await params;
  const locale = lang as Locale;

  const dictionary = getDictionary(locale, "adminOrders");
  const common = getDictionary(locale, "common");
  const orders = await getArchivedOrdersForAdmin();

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.archivedPageTitle ?? "Past Orders"}
        subtitle={dictionary.archivedListTitle ?? "Orders from previous days"}
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
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/orders")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dictionary.backToToday ?? "Back to Today"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <ArchivedOrdersClient initialOrders={orders} dictionary={dictionary} />
      </div>
    </AdminLayoutShell>
  );
}
