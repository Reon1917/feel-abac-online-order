import { unstable_noStore as noStore } from "next/cache";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { PromptPayAccountsClient } from "@/components/admin/promptpay/promptpay-accounts-client";
import { listPromptPayAccounts } from "@/lib/payments/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function PromptPaySettingsPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;

  const dictionary = getDictionary(locale, "adminPromptpay");
  const common = getDictionary(locale, "common");
  const accounts = await listPromptPayAccounts();

  const activeAccounts = accounts.filter((a) => a.isActive);
  const primaryAccount = accounts.find((a) => a.isPrimary);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.pageTitle}
        subtitle={dictionary.pageSubtitle}
        languageLabels={common.languageSwitcher}
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={3}>
          <StatsCard
            title="Total Accounts"
            value={accounts.length}
            subtitle="Configured payment accounts"
          />
          <StatsCard
            title="Active"
            value={activeAccounts.length}
            subtitle="Available for payments"
            variant="success"
          />
          <StatsCard
            title="Primary"
            value={primaryAccount ? 1 : 0}
            subtitle={primaryAccount?.displayName ?? "Not set"}
            variant={primaryAccount ? "info" : "warning"}
          />
        </StatsGrid>

        <div className="mt-4 md:mt-6">
          <PromptPayAccountsClient
            initialAccounts={accounts}
            dictionary={dictionary}
          />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
