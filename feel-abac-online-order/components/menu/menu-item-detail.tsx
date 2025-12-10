"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PublicMenuChoiceGroup, PublicMenuItem } from "@/lib/menu/types";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart/types";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";
import {
  consumeMenuReturnFlag,
  markMenuNeedsRefresh,
} from "./menu-scroll";
import { emitCartChange } from "@/lib/cart/events";
import { SetMenuBuilder, type SetMenuBuilderSelection } from "./set-menu-builder";
import { AddToCartFooter } from "./add-to-cart-footer";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");

type MenuItemDetailProps = {
  item: PublicMenuItem;
  category: {
    name: string;
    nameMm: string | null;
  };
  detail: MenuDictionary["detail"];
  locale: Locale;
};

type SelectionState = Record<string, string[]>;

type ChoiceGroupWithState = PublicMenuChoiceGroup & {
  isSingle: boolean;
  maxSelectable: number;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRequirementLabel(
  group: PublicMenuChoiceGroup,
  detail: MenuDictionary["detail"]
) {
  const { minSelect, maxSelect } = group;

  if (minSelect <= 0 && maxSelect === 1) {
    return detail.chooseOne;
  }

  if (minSelect <= 0 && maxSelect > 1) {
    return detail.chooseUpTo.replace("{{count}}", String(maxSelect));
  }

  if (minSelect > 0 && maxSelect > 0) {
    return detail.chooseBetween
      .replace("{{min}}", String(minSelect))
      .replace("{{max}}", String(maxSelect));
  }

  if (minSelect > 0) {
    return detail.chooseAtLeast.replace("{{min}}", String(minSelect));
  }

  return null;
}

export function MenuItemDetail({
  item,
  category,
  detail,
  locale,
}: MenuItemDetailProps) {
  const { menuLocale } = useMenuLocale();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SelectionState>(() => {
    const initialEntries = item.choiceGroups.map((group) => [group.id, []]);
    return Object.fromEntries(initialEntries);
  });
  const [quantity, setQuantity] = useState(1);
  const [setMenuTotals, setSetMenuTotals] = useState<{
    basePrice: number;
    addonsTotal: number;
    totalPrice: number;
    quantity: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queuedRequest, setQueuedRequest] = useState(false);

  const enhancedGroups = useMemo<ChoiceGroupWithState[]>(() => {
    return item.choiceGroups
      .map((group) => {
        const maxSelectable = group.maxSelect > 0 ? group.maxSelect : Number.MAX_SAFE_INTEGER;
        return {
          ...group,
          isSingle: maxSelectable === 1,
          maxSelectable,
        } satisfies ChoiceGroupWithState;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [item.choiceGroups]);

  const optionPriceLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of item.choiceGroups) {
      for (const option of group.options) {
        map.set(option.id, option.extraPrice);
      }
    }
    return map;
  }, [item.choiceGroups]);

  const basePrice = item.price;
  const extrasPerUnit = useMemo(() => {
    let total = 0;
    for (const groupSelections of Object.values(selections)) {
      for (const optionId of groupSelections) {
        total += optionPriceLookup.get(optionId) ?? 0;
      }
    }
    return total;
  }, [optionPriceLookup, selections]);

  const isSetMenu = item.isSetMenu;
  const effectiveQuantity = isSetMenu
    ? setMenuTotals?.quantity ?? 1
    : quantity;
  const effectiveBasePrice = isSetMenu
    ? setMenuTotals?.basePrice ?? basePrice
    : basePrice;
  const effectiveExtrasPerUnit = isSetMenu
    ? setMenuTotals?.addonsTotal ?? 0
    : extrasPerUnit;

  const baseSubtotal = effectiveBasePrice * effectiveQuantity;
  const extrasSubtotal = effectiveExtrasPerUnit * effectiveQuantity;
  const totalPrice =
    isSetMenu && setMenuTotals
      ? setMenuTotals.totalPrice
      : (effectiveBasePrice + effectiveExtrasPerUnit) * effectiveQuantity;

  const formattedBasePrice = formatPrice(effectiveBasePrice);
  const formattedBaseSubtotal = formatPrice(baseSubtotal);
  const formattedExtrasSubtotal = formatPrice(extrasSubtotal);
  const formattedTotalPrice = formatPrice(totalPrice);

  const displayName = menuLocale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    menuLocale === "my"
      ? item.descriptionMm ?? item.description ?? null
      : item.description ?? item.descriptionMm ?? null;
  const categoryLabel =
    menuLocale === "my" ? category.nameMm ?? category.name : category.name;

  const mobileButtonLabel = detail.mobileButton ?? detail.button;
  const canDecrease = quantity > 1;
  const canIncrease = quantity < MAX_QUANTITY_PER_LINE;
  const decreaseQuantity = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increaseQuantity = () =>
    setQuantity((prev) => Math.min(MAX_QUANTITY_PER_LINE, prev + 1));

  const handleAddToCart = async () => {
    const missingRequired = enhancedGroups.find((group) => {
      const required = Math.max(group.minSelect, group.isRequired ? 1 : 0);
      const selected = selections[group.id]?.length ?? 0;
      return required > 0 && selected < required;
    });

    if (missingRequired) {
      toast.error(detail.missingRequired);
      return;
    }

    const selectionPayload = enhancedGroups
      .map((group) => ({
        groupId: group.id,
        optionIds: selections[group.id] ?? [],
      }))
      .filter((entry) => entry.optionIds.length > 0);

    const trimmedNote = notes.trim();
    const notePayload =
      item.allowUserNotes && trimmedNote.length > 0 ? trimmedNote : null;

    if (isSubmitting) {
      setQueuedRequest(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          menuItemId: item.id,
          quantity,
          note: notePayload,
          selections: selectionPayload,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage =
          (data && typeof data.error === "string" && data.error) ||
          detail.addToCartError;
        throw new Error(errorMessage);
      }

      router.refresh();
      emitCartChange();

      toast.success(detail.addedToCart);
      const destination = withLocalePath(locale, "/menu");
      const shouldReturnToMenu = consumeMenuReturnFlag(locale);
      let isSafeSameOriginReferrer = false;

      if (shouldReturnToMenu) {
        try {
          const referrer = document.referrer;
          if (referrer) {
            const referrerUrl = new URL(referrer);
            isSafeSameOriginReferrer =
              referrerUrl.origin === window.location.origin;
          }
        } catch {
          isSafeSameOriginReferrer = false;
        }
      }

      if (shouldReturnToMenu && isSafeSameOriginReferrer) {
        markMenuNeedsRefresh(locale);
        router.back();
      } else {
        router.push(destination, { scroll: false });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : detail.addToCartError;
      toast.error(message);
    } finally {
      setIsSubmitting(false);

      if (queuedRequest) {
        setQueuedRequest(false);
        void handleAddToCart();
      }
    }
  };

  // Handler for set menu add to cart
  const handleSetMenuAddToCart = async (
    setMenuSelections: SetMenuBuilderSelection[],
    qty: number
  ) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/cart/set-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          menuItemId: item.id,
          quantity: qty,
          note: notes.trim() || null,
          selections: setMenuSelections,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage =
          (data && typeof data.error === "string" && data.error) ||
          detail.addToCartError;
        throw new Error(errorMessage);
      }

      router.refresh();
      emitCartChange();

      toast.success(detail.addedToCart);
      const destination = withLocalePath(locale, "/menu");
      const shouldReturnToMenu = consumeMenuReturnFlag(locale);
      let isSafeSameOriginReferrer = false;

      if (shouldReturnToMenu) {
        try {
          const referrer = document.referrer;
          if (referrer) {
            const referrerUrl = new URL(referrer);
            isSafeSameOriginReferrer =
              referrerUrl.origin === window.location.origin;
          }
        } catch {
          isSafeSameOriginReferrer = false;
        }
      }

      if (shouldReturnToMenu && isSafeSameOriginReferrer) {
        markMenuNeedsRefresh(locale);
        router.back();
      } else {
        router.push(destination, { scroll: false });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : detail.addToCartError;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = (group: ChoiceGroupWithState, optionId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      let nextGroupSelections: string[] = current;
      const requiredCount = group.isRequired || group.minSelect > 0 ? Math.max(1, group.minSelect) : group.minSelect;

      if (group.isSingle) {
        const exists = current.includes(optionId);
        if (exists) {
          if (requiredCount > 0) {
            return prev;
          }
          nextGroupSelections = [];
        } else {
          nextGroupSelections = [optionId];
        }
      } else {
        const exists = current.includes(optionId);
        if (exists) {
          const candidate = current.filter((id) => id !== optionId);
          if (requiredCount > 0 && candidate.length < requiredCount) {
            return prev;
          }
          nextGroupSelections = candidate;
        } else {
          const limitReached = current.length >= group.maxSelectable;
          if (limitReached) {
            return prev;
          }
          nextGroupSelections = [...current, optionId];
        }
      }

      return {
        ...prev,
        [group.id]: nextGroupSelections,
      };
    });
  };

  return (
    <>
      <div className="grid gap-8 pb-24 sm:gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:pb-0">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
          <div className="relative h-52 w-full overflow-hidden bg-emerald-50 sm:h-60 lg:h-72">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 640px"
                loading="eager"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl sm:text-6xl">
                {item.placeholderIcon ?? "🍽️"}
              </div>
            )}
          </div>

            <div className="space-y-4 p-6 sm:p-8">
              <div className="space-y-2">
                <div className="text-sm font-medium uppercase tracking-wide text-emerald-600">
                  {detail.categoryPrefix}: {categoryLabel}
                </div>
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{displayName}</h1>
                {descriptionCopy ? (
                  <p className="text-sm text-slate-600 sm:text-base">{descriptionCopy}</p>
                ) : null}
              </div>

              {!item.isSetMenu && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 sm:px-4">
                  <strong className="font-semibold text-slate-900">
                    {detail.basePrice}:
                  </strong>{" "}
                  ฿{formattedBasePrice}
                </div>
              )}
              {item.isSetMenu && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 sm:px-4">
                  <strong className="font-semibold text-emerald-900">
                    Build Your Set:
                  </strong>{" "}
                  Choose your options below
                </div>
              )}
            </div>
          </div>

          {/* Set Menu Builder */}
          {item.isSetMenu && item.poolLinks && item.poolLinks.length > 0 ? (
            <SetMenuBuilder
              poolLinks={item.poolLinks}
              menuLocale={menuLocale}
              onAddToCart={handleSetMenuAddToCart}
              isSubmitting={isSubmitting}
              onTotalsChange={setSetMenuTotals}
            />
          ) : null}

          {/* Regular Choice Groups (only for non-set menus) */}
          {!item.isSetMenu && enhancedGroups.length > 0 ? (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {detail.choicesHeading}
              </h2>

              <div className="space-y-5">
                {enhancedGroups.map((group) => {
                const selection = selections[group.id] ?? [];
                const requirement = getRequirementLabel(group, detail);
                const maxSelectable = group.maxSelectable;
                const limitReached =
                  !group.isSingle &&
                  maxSelectable < Number.MAX_SAFE_INTEGER &&
                  selection.length >= maxSelectable;

                return (
                  <article
                    key={group.id}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                          {menuLocale === "my"
                            ? group.titleMm ?? group.title
                            : group.title}
                        </h3>
                        {requirement ? (
                          <p className="text-sm text-slate-500">{requirement}</p>
                        ) : null}
                      </div>
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          group.isRequired
                            ? "bg-rose-50 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {group.isRequired ? detail.required : detail.optional}
                      </span>
                    </header>

                    <div className="space-y-3">
                      {group.options.map((option) => {
                        const isChecked = selection.includes(option.id);
                        const isSingle = group.isSingle;
                        const inputType = isSingle ? "radio" : "checkbox";
                        const disableOption =
                          !isSingle && limitReached && !isChecked;
                        const optionLabel =
                          menuLocale === "my"
                            ? option.nameMm ?? option.name
                            : option.name;
                        const extraPrice = option.extraPrice;

                        return (
                          <label
                            key={option.id}
                            className={clsx(
                              "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm transition sm:px-4",
                              isChecked
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                            )}
                          >
                            <span className="flex flex-1 items-center gap-3">
                              <input
                                type={inputType}
                                name={`group-${group.id}`}
                                value={option.id}
                                checked={isChecked}
                                disabled={disableOption}
                                onChange={() => handleSelect(group, option.id)}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              <span className="font-medium">{optionLabel}</span>
                            </span>
                            {extraPrice > 0 ? (
                              <span className="text-sm font-semibold text-emerald-600">
                                +฿{formatPrice(extraPrice)}
                              </span>
                            ) : (
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                {detail.included}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        </section>

        <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6 lg:sticky lg:top-24">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            {detail.totalLabel}
          </h2>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{detail.basePrice}</span>
            <div className="text-right">
              <span className="block text-sm font-medium text-slate-700">
                ฿{formattedBaseSubtotal}
              </span>
              <span className="text-xs text-slate-400">× {effectiveQuantity}</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{detail.addonsLabel}</span>
            <div className="text-right">
              <span className="block text-sm font-medium text-slate-700">
                ฿{formattedExtrasSubtotal}
              </span>
              <span className="text-xs text-slate-400">× {effectiveQuantity}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
            <span className="text-base font-semibold text-emerald-700">
              {detail.totalLabel}
            </span>
            <span className="text-2xl font-semibold text-emerald-600">
              ฿{formattedTotalPrice}
            </span>
          </div>
        </div>

        {item.allowUserNotes ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="menu-item-notes">
              {detail.noteLabel}
            </label>
            <textarea
              id="menu-item-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={detail.notePlaceholder}
              className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:px-4"
            />
          </div>
        ) : null}

        </aside>
      </div>

      {!item.isSetMenu && (
        <AddToCartFooter
          quantity={quantity}
          canDecrease={canDecrease}
          canIncrease={canIncrease}
          onDecrease={decreaseQuantity}
          onIncrease={increaseQuantity}
          onAddToCart={handleAddToCart}
          isSubmitting={isSubmitting}
          isDisabled={false}
          label={mobileButtonLabel}
          busyLabel={detail.addingToCart ?? mobileButtonLabel}
          priceLabel={`฿${formattedTotalPrice}`}
        />
      )}
    </>
  );
}
