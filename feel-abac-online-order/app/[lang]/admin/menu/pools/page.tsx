import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { getAllChoicePools } from "@/lib/menu/pool-queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
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

  const pools = await getAllChoicePools();

  const totalPools = pools.length;
  const totalOptions = pools.reduce((sum, pool) => sum + pool.options.length, 0);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title="Choice Pools"
        subtitle="Manage reusable option pools for set menus"
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/menu")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Menu Builder
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={3}>
          <StatsCard
            title="Choice Pools"
            value={totalPools}
            subtitle="Groups of options for set menu items"
          />
          <StatsCard
            title="Total Options"
            value={totalOptions}
            subtitle="Individual choices across all pools"
          />
          <StatsCard
            title="Usage"
            value={pools.filter((p) => p.options.length > 0).length}
            subtitle="Pools with active options"
            variant="success"
          />
        </StatsGrid>

        <div className="mt-4 md:mt-6">
          <PoolManager initialPools={pools} />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
