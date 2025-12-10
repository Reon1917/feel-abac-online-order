import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getAdminRecommendedMenuItems } from "@/lib/menu/recommendations";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { Button } from "@/components/ui/button";
import { RecommendedItemsCard } from "@/components/admin/menu/recommended-items-card";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminRecommendedMenuPage({
  params,
}: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");

  const [menu, recommended] = await Promise.all([
    getAdminMenuHierarchy(),
    getAdminRecommendedMenuItems(),
  ]);

  const featuredCount = recommended.length;
  const totalItems = menu.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dict.recommendationsPage?.title ?? "Featured Items"}
        subtitle={
          dict.recommendationsPage?.subtitle ??
          "Pin dishes to highlight at the top of the diner menu"
        }
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/menu")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dict.recommendationsPage?.buttons?.builder ?? "Menu Builder"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={3}>
          <StatsCard
            title={dict.recommendationsPage?.stats?.label ?? "Featured Items"}
            value={featuredCount}
            subtitle="Pinned at the top of diner menu"
            variant="success"
          />
          <StatsCard
            title="Total Menu Items"
            value={totalItems}
            subtitle="Available items to feature"
          />
          <StatsCard
            title="Categories"
            value={menu.length}
            subtitle="Active menu categories"
          />
        </StatsGrid>

        <div className="mt-4 md:mt-6">
          <RecommendedItemsCard
            menu={menu}
            initialRecommendations={recommended}
            dictionary={dict.recommendationsManager}
          />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
