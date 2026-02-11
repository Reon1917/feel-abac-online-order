"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { PublicMenuItem } from "@/lib/menu/types";
import { emitCartChange } from "@/lib/cart/events";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { extractActiveOrderBlock } from "@/lib/orders/active-order";

export type QuickAddPayload = {
  item: PublicMenuItem;
  rect?: DOMRect | null;
  detailHref: string;
};

export type QuickAddMessages = {
  success?: string;
  error: string;
  activeOrderBlock?: {
    message: string;
    cta: string;
    locale: Locale;
  };
};

type QuickAddResult =
  | { status: "added" }
  | { status: "error"; message: string };

type UseQuickAddOptions = {
  messages: QuickAddMessages;
};

export function canQuickAddItem(item: PublicMenuItem) {
  if (item.isSetMenu) {
    return false;
  }
  return (item.choiceGroups?.length ?? 0) === 0;
}

export function useQuickAddToCart({ messages }: UseQuickAddOptions) {
  const router = useRouter();

  const quickAdd = useCallback(
    async (item: PublicMenuItem): Promise<QuickAddResult> => {
      try {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuItemId: item.id,
            quantity: 1,
            selections: [],
            note: null,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const activeOrder = extractActiveOrderBlock(data);

          if (activeOrder && messages.activeOrderBlock) {
            const { message, cta, locale } = messages.activeOrderBlock;
            toast.error(message, {
              action: {
                label: cta,
                onClick: () => {
                  router.push(
                    withLocalePath(locale, `/orders/${activeOrder.displayId}`)
                  );
                },
              },
            });
            return { status: "error", message };
          }

          const message =
            (data && typeof data.error === "string" && data.error) ||
            messages.error;
          throw new Error(message);
        }

        startTransition(() => {
          router.refresh();
        });
        emitCartChange();
        return { status: "added" };
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : messages.error;
        toast.error(fallback);
        return { status: "error", message: fallback };
      }
    },
    [messages.activeOrderBlock, messages.error, router]
  );

  return {
    quickAdd,
  };
}

export type QuickAddHandler = (payload: QuickAddPayload) => void;
