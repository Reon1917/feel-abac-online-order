import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Layers, Star } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { AdminMenuManager } from "@/components/admin/menu/menu-manager";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { withLocalePath } from "@/lib/i18n/path";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminMenuPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");

  const menu = await getAdminMenuHierarchy();
  const totalCategories = menu.length;
  const hiddenCategories = menu.filter((category) => !category.isActive).length;
  const totalItems = menu.reduce((sum, category) => sum + category.items.length, 0);
  const publishedItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status === "published").length,
    0
  );
  const draftItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status !== "published").length,
    0
  );
  const unavailableItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => !item.isAvailable).length,
    0
  );

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dict.header.title}
        subtitle={dict.header.subtitle}
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/menu/pools")}>
                <Layers className="mr-2 h-4 w-4" />
                Choice Pools
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/menu/recommended")}>
                <Star className="mr-2 h-4 w-4" />
                Staff&apos;s Picks
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={4}>
          <StatsCard
            title={dict.stats.categories.label}
            value={totalCategories}
            subtitle={
              hiddenCategories === 0
                ? dict.stats.categories.allVisible
                : dict.stats.categories.hidden.replace("%s", String(hiddenCategories))
            }
          />
          <StatsCard
            title={dict.stats.menuItems.label}
            value={totalItems}
            subtitle={
              unavailableItems === 0
                ? dict.stats.menuItems.allAvailable
                : dict.stats.menuItems.unavailable.replace("%s", String(unavailableItems))
            }
          />
          <StatsCard
            title={dict.stats.published.label}
            value={publishedItems}
            subtitle={
              publishedItems === 0
                ? dict.stats.published.nothingLive
                : dict.stats.published.liveForDiners
            }
            variant="success"
          />
          <StatsCard
            title={dict.stats.drafts.label}
            value={draftItems}
            subtitle={
              draftItems === 0
                ? dict.stats.drafts.nothingPending
                : dict.stats.drafts.awaitingReview.replace("%s", String(draftItems))
            }
            variant="warning"
          />
        </StatsGrid>

        <div className="mt-4 md:mt-6">
          <AdminMenuManager initialMenu={menu} variant="workspace" />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
