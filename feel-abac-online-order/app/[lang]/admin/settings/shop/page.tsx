import { unstable_noStore as noStore } from "next/cache";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { ShopSettingsClient } from "@/components/admin/shop/shop-settings-client";
import { getShopStatus } from "@/lib/shop/queries";
import type { Locale } from "@/lib/i18n/config";

const FALLBACK_MESSAGES = {
  en: "Sorry, we are currently closed. Please check back again when the shop is open.",
  mm: "ဝမ်းနည်းပါတယ်၊ ဆိုင်ပိတ်ထားပါသည်။ ဆိုင်ဖွင့်ချိန်တွင် ပြန်လည်ဝင်ရောက်ကြည့်ရှုပါ။",
};

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function ShopSettingsPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;

  const status = await getShopStatus();

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title="Shop status"
        subtitle="Open/close the shop and customize the closed message"
        languageLabels={{ label: "Language", english: "English", burmese: "Burmese" }}
      />

      <div className="p-4 md:p-6 lg:p-8">
        <ShopSettingsClient initialStatus={status} fallbackMessages={FALLBACK_MESSAGES} />
      </div>
    </AdminLayoutShell>
  );
}
