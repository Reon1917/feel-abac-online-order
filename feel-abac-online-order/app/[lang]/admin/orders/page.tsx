import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Archive, CreditCard } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { OrderListClient } from "@/components/admin/orders/order-list-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getTodayOrdersForAdmin } from "@/lib/orders/queries";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { Button } from "@/components/ui/button";

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

  // Calculate stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "order_processing").length;
  const confirmedOrders = orders.filter((o) =>
    [
      "awaiting_payment",
      "payment_review",
      "order_in_kitchen",
      "order_out_for_delivery",
    ].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) => o.status === "delivered").length;

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
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/settings/promptpay")}>
                <CreditCard className="mr-2 h-4 w-4" />
                {dictionary.promptpaySettings ?? "PromptPay"}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/orders/archived")}>
                <Archive className="mr-2 h-4 w-4" />
                {dictionary.viewPastOrders ?? "Past Orders"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={4}>
          <StatsCard
            title="Total Today"
            value={totalOrders}
            subtitle="Orders received"
          />
          <StatsCard
            title="Pending"
            value={pendingOrders}
            subtitle="Awaiting confirmation"
            variant="warning"
          />
          <StatsCard
            title="Confirmed"
            value={confirmedOrders}
            subtitle="Being prepared"
            variant="info"
          />
          <StatsCard
            title="Completed"
            value={completedOrders}
            subtitle="Fulfilled today"
            variant="success"
          />
        </StatsGrid>

        <div className="mt-4 md:mt-6">
          <OrderListClient initialOrders={orders} dictionary={dictionary} />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
