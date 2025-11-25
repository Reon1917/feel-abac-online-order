import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { OrderListClient } from "@/components/admin/orders/order-list-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getRecentOrdersForAdmin } from "@/lib/orders/queries";
import { getSession } from "@/lib/session";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminOrdersPage({ params }: PageProps) {
  noStore();
  const { lang } = await params;
  const locale = lang as Locale;

  const session = await getSession();
  if (!session?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const dictionary = getDictionary(locale, "adminOrders");
  const orders = await getRecentOrdersForAdmin();

  return (
    <>
      <AdminBar />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              {dictionary.pageTitle}
            </h1>
            <p className="text-sm text-slate-600">
              {dictionary.listTitle}
            </p>
          </div>
          <OrderListClient
            initialOrders={orders}
            dictionary={dictionary}
            locale={locale}
          />
        </div>
      </main>
    </>
  );
}
