"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/src/db/client";
import { shopSettings } from "@/src/db/schema";

const SHOP_STATUS_TAG = "shop-status";
const SHOP_STATUS_KEY = [SHOP_STATUS_TAG];

export type ShopStatus = {
  isOpen: boolean;
  closedMessageEn: string | null;
  closedMessageMm: string | null;
  updatedAt: Date | null;
  updatedByAdminId: string | null;
};

// Cached shop status; revalidates every 60s or when tag is revalidated
export const getShopStatus = unstable_cache(
  async (): Promise<ShopStatus> => {
    const [settings] = await db.select().from(shopSettings).limit(1);

    return {
      isOpen: settings?.isOpen ?? true,
      closedMessageEn: settings?.closedMessageEn ?? null,
      closedMessageMm: settings?.closedMessageMm ?? null,
      updatedAt: settings?.updatedAt ?? null,
      updatedByAdminId: settings?.updatedByAdminId ?? null,
    };
  },
  SHOP_STATUS_KEY,
  { revalidate: 60, tags: [SHOP_STATUS_TAG] }
);

export async function setShopStatus(
  isOpen: boolean,
  adminId: string,
  messageEn?: string,
  messageMm?: string
) {
  await db
    .insert(shopSettings)
    .values({
      id: "default",
      isOpen,
      closedMessageEn: messageEn,
      closedMessageMm: messageMm,
      updatedByAdminId: adminId,
    })
    .onConflictDoUpdate({
      target: shopSettings.id,
      set: {
        isOpen,
        closedMessageEn: messageEn,
        closedMessageMm: messageMm,
        updatedByAdminId: adminId,
      },
    });

  revalidateTag(SHOP_STATUS_TAG);
}
