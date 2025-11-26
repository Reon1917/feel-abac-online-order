import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { OrderListClient } from "@/components/admin/orders/order-list-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getTodayOrdersForAdmin } from "@/lib/orders/queries";
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
  const orders = await getTodayOrdersForAdmin();

  return (
    <>
      <AdminBar />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {dictionary.pageTitle}
              </h1>
              <p className="text-sm text-slate-600">
                {dictionary.todayListTitle ?? dictionary.listTitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={withLocalePath(locale, "/admin/settings/promptpay")}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-100"
              >
                {dictionary.promptpaySettings ?? "PromptPay Settings"}
              </Link>
              <Link
                href={withLocalePath(locale, "/admin/orders/archived")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {dictionary.viewPastOrders ?? "Past Orders"}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <OrderListClient
            initialOrders={orders}
            dictionary={dictionary}
          />
        </div>
      </main>
    </>
  );
}
