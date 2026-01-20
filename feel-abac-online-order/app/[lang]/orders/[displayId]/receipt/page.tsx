import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { ReceiptView } from "@/components/orders/receipt-view";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getOrderByDisplayId } from "@/lib/orders/queries";
import { getSession } from "@/lib/session";
import { db } from "@/src/db/client";
import { deliveryLocations, deliveryBuildings } from "@/src/db/schema";
import { eq } from "drizzle-orm";

type PageProps = {
  params: Promise<{
    lang: string;
    displayId: string;
  }>;
};

export default async function ReceiptPage({ params }: PageProps) {
  noStore();

  const { lang, displayId } = await params;
  const locale = lang as Locale;
  const trimmedDisplayId = displayId.trim();

  if (!trimmedDisplayId) {
    notFound();
  }

  const session = await getSession();
  if (!session?.session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const order = await getOrderByDisplayId(trimmedDisplayId, {
    userId: session.session.user.id,
    isAdmin: session.isAdmin,
  });

  if (!order) {
    notFound();
  }

  // Only allow receipt for delivered or closed orders
  if (order.status !== "delivered" && order.status !== "closed") {
    redirect(withLocalePath(locale, `/orders/${trimmedDisplayId}`));
  }

  // Get both dictionaries for bilingual PDF download
  const dictionaryEn = getDictionary("en", "order");
  const dictionaryMy = getDictionary("my", "order");

  // Build delivery address string
  let deliveryAddress = "";
  if (order.deliveryMode === "preset" && order.deliveryLocationId) {
    const [location] = await db
      .select({ condoName: deliveryLocations.condoName })
      .from(deliveryLocations)
      .where(eq(deliveryLocations.id, order.deliveryLocationId))
      .limit(1);

    let buildingLabel = "";
    if (order.deliveryBuildingId) {
      const [building] = await db
        .select({ label: deliveryBuildings.label })
        .from(deliveryBuildings)
        .where(eq(deliveryBuildings.id, order.deliveryBuildingId))
        .limit(1);
      buildingLabel = building?.label ?? "";
    }

    deliveryAddress = [location?.condoName, buildingLabel]
      .filter(Boolean)
      .join(" – ");
  } else if (order.deliveryMode === "custom") {
    deliveryAddress = [order.customCondoName, order.customBuildingName]
      .filter(Boolean)
      .join(" – ");
  }

  return (
    <ReceiptView
      order={order}
      deliveryAddress={deliveryAddress}
      dictionaryEn={dictionaryEn}
      dictionaryMy={dictionaryMy}
    />
  );
}
