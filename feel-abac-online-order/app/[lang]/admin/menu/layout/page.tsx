import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { MenuLayoutEditor } from "@/components/admin/menu/menu-layout-editor";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
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

  const dict = getDictionary(locale, "adminMenu");
  const common = getDictionary(locale, "common");
  const menu = await getAdminMenuHierarchy();

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dict.layoutEditor.title}
        subtitle={dict.layoutEditor.subtitle}
        languageLabels={common.languageSwitcher}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={withLocalePath(locale, "/admin/menu")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {dict.layoutEditor.backToBuilder}
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <MenuLayoutEditor initialMenu={menu} labels={dict.layoutEditor} />
      </div>
    </AdminLayoutShell>
  );
}
