import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { ArchivedOrdersClient } from "@/components/admin/orders/archived-orders-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getArchivedOrdersForAdmin } from "@/lib/orders/queries";
import { getSession } from "@/lib/session";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function ArchivedOrdersPage({ params }: PageProps) {
  noStore();
  const { lang } = await params;
  const locale = lang as Locale;

  const session = await getSession();
  if (!session?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const dictionary = getDictionary(locale, "adminOrders");
  const orders = await getArchivedOrdersForAdmin();

  return (
    <>
      <AdminBar />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Link
                href={withLocalePath(locale, "/admin/orders")}
                className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <span aria-hidden="true">←</span>
                {dictionary.backToToday ?? "Back to Today's Orders"}
              </Link>
              <h1 className="text-2xl font-semibold text-slate-900">
                {dictionary.archivedPageTitle ?? "Past Orders"}
              </h1>
              <p className="text-sm text-slate-600">
                {dictionary.archivedListTitle ?? "Orders from previous days"}
              </p>
            </div>
            <MenuLanguageToggle
              labels={{
                label: dictionary.menuLanguageLabel ?? "Menu language",
                english: dictionary.menuLanguageEnglish ?? "English names",
                burmese: dictionary.menuLanguageBurmese ?? "Burmese names",
              }}
              hideLabel
            />
          </div>
          <ArchivedOrdersClient
            initialOrders={orders}
            dictionary={dictionary}
          />
        </div>
      </main>
    </>
  );
}
