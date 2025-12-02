import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { getOrdersForUser } from "@/lib/orders/queries";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { MobileBottomNav } from "@/components/menu/mobile-bottom-nav";
import { OrdersClient } from "@/components/orders/orders-client";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function OrdersPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dictionary = getDictionary(locale, "order");
  const common = getDictionary(locale, "common");
  const profileDict = getDictionary(locale, "profile");

  const session = await getCurrentSession();

  if (!session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(session.user.id);

  if (!profile?.phoneNumber) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  const userOrders = await getOrdersForUser(session.user.id);

  // Build status labels from order dictionary
  const statusLabels: Record<string, string> = {
    order_processing: dictionary.statusProcessing,
    awaiting_food_payment: dictionary.statusAwaitingFoodPayment,
    food_payment_review: dictionary.statusAwaitingFoodPayment,
    order_in_kitchen: dictionary.statusKitchen,
    order_out_for_delivery: dictionary.statusOutForDelivery,
    awaiting_delivery_fee_payment: dictionary.statusAwaitingDeliveryFee,
    delivered: dictionary.statusDelivered,
    cancelled: dictionary.statusCancelled,
  };

  // Tab labels - use dictionary values or fallback
  const tabLabels = {
    ongoing: dictionary.tabOngoing ?? "Ongoing",
    completed: dictionary.tabCompleted ?? "Completed",
    cancelled: dictionary.tabCancelled ?? "Cancelled",
  };

  return (
    <>
      <main className="min-h-screen w-full bg-slate-50 pb-24 sm:pb-10 sm:pl-20 lg:pl-24">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <Link
              href={withLocalePath(locale, "/menu")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {dictionary.backToMenu ?? "Back to menu"}
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
              {dictionary.listPageTitle ?? profileDict.sections.orderHistory.title}
            </h1>
          </div>

          <OrdersClient
            orders={userOrders}
            locale={locale}
            statusLabels={statusLabels}
            tabLabels={tabLabels}
            emptyState={{
              noOrders: dictionary.noOrdersYet ?? profileDict.sections.orderHistory.noOrders,
              noOrdersDescription: dictionary.startOrdering ?? profileDict.sections.orderHistory.noOrdersDescription,
              browseMenu: dictionary.browseMenu ?? "Browse Menu",
            }}
          />
        </div>
      </main>
      <MobileBottomNav locale={locale} labels={common.mobileNav} />
    </>
  );
}
