"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { PublicMenuItem } from "@/lib/menu/types";
import { emitCartChange } from "@/lib/cart/events";

export type QuickAddPayload = {
  item: PublicMenuItem;
  rect?: DOMRect | null;
  detailHref: string;
};

export type QuickAddMessages = {
  success?: string;
  error: string;
};

type QuickAddResult =
  | { status: "added" }
  | { status: "error"; message: string };

type UseQuickAddOptions = {
  messages: QuickAddMessages;
};

export function canQuickAddItem(item: PublicMenuItem) {
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
    [messages.error, router]
  );

  return {
    quickAdd,
  };
}

export type QuickAddHandler = (payload: QuickAddPayload) => void;
