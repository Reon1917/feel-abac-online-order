import { unstable_noStore as noStore } from "next/cache";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
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

  // Calculate stats matching the workflow overview
  const receivedOrders = orders.filter((o) => o.status === "order_processing").length;
  const paymentOrders = orders.filter((o) =>
    ["awaiting_payment", "payment_review"].includes(o.status)
  ).length;
  const activeOrders = orders.filter((o) =>
    ["order_in_kitchen", "order_out_for_delivery"].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) =>
    ["delivered", "closed"].includes(o.status)
  ).length;

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
        <StatsGrid columns={4}>
          <StatsCard
            title="Received"
            value={receivedOrders}
            subtitle="New orders"
            variant={receivedOrders > 0 ? "warning" : "default"}
          />
          <StatsCard
            title="Payment"
            value={paymentOrders}
            subtitle="Awaiting payment"
            variant={paymentOrders > 0 ? "info" : "default"}
          />
          <StatsCard
            title="Active"
            value={activeOrders}
            subtitle="Preparing / delivering"
            variant="info"
          />
          <StatsCard
            title="Completed"
            value={completedOrders}
            subtitle="Delivered today"
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
