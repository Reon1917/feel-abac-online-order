import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { OrderStatusClient } from "@/components/orders/order-status-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getOrderByDisplayId } from "@/lib/orders/queries";
import { getSession } from "@/lib/session";

type PageProps = {
  params: Promise<{
    lang: string;
    displayId: string;
  }>;
};

export default async function OrderPage({ params }: PageProps) {
  noStore();

  const { lang, displayId } = await params;
  const locale = lang as Locale;

  const session = await getSession();
  if (!session?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const dictionary = getDictionary(locale, "order");

  const order = await getOrderByDisplayId(displayId, {
    userId: session.session.user.id,
    isAdmin: session.isAdmin,
  });

  if (!order) {
    notFound();
  }

  return (
    <>
      <main className="min-h-screen w-full bg-slate-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <OrderStatusClient
            initialOrder={order}
            dictionary={dictionary}
            isAdmin={false}
          />
        </div>
      </main>
    </>
  );
}
