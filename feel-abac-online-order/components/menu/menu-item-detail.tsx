"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import type { PublicMenuChoiceGroup, PublicMenuItem } from "@/lib/menu/types";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");

type MenuItemDetailProps = {
  item: PublicMenuItem;
  category: {
    name: string;
    nameMm: string | null;
  };
  detail: MenuDictionary["detail"];
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

export function MenuItemDetail({ item, category, detail }: MenuItemDetailProps) {
  const { menuLocale } = useMenuLocale();
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SelectionState>(() => {
    const initialEntries = item.choiceGroups.map((group) => [group.id, []]);
    return Object.fromEntries(initialEntries);
  });

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
  const extrasTotal = useMemo(() => {
    let total = 0;
    for (const groupSelections of Object.values(selections)) {
      for (const optionId of groupSelections) {
        total += optionPriceLookup.get(optionId) ?? 0;
      }
    }
    return total;
  }, [optionPriceLookup, selections]);

  const totalPrice = basePrice + extrasTotal;

  const displayName = menuLocale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    menuLocale === "my"
      ? item.descriptionMm ?? item.description ?? null
      : item.description ?? item.descriptionMm ?? null;
  const categoryLabel =
    menuLocale === "my" ? category.nameMm ?? category.name : category.name;

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
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
      <section className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-72 w-full overflow-hidden bg-emerald-50">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 640px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl">
                {item.placeholderIcon ?? "🍽️"}
              </div>
            )}
          </div>

          <div className="space-y-4 p-8">
            <div className="space-y-2">
              <div className="text-sm font-medium uppercase tracking-wide text-emerald-600">
                {detail.categoryPrefix}: {categoryLabel}
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">{displayName}</h1>
              {descriptionCopy ? (
                <p className="text-base text-slate-600">{descriptionCopy}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">
                {detail.basePrice}:
              </strong>{" "}
              ฿{formatPrice(basePrice)}
            </div>
          </div>
        </div>

        {enhancedGroups.length > 0 ? (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900">
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
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
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
                              "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition",
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
                                onChange={() =>
                                      handleSelect(group, option.id)
                                }
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

      <aside className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">
            {detail.totalLabel}
          </h2>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{detail.basePrice}</span>
            <span className="text-sm font-medium text-slate-700">
              ฿{formatPrice(basePrice)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{detail.addonsLabel}</span>
            <span className="text-sm font-medium text-slate-700">
              ฿{formatPrice(extrasTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
            <span className="text-base font-semibold text-emerald-700">
              {detail.totalLabel}
            </span>
            <span className="text-2xl font-semibold text-emerald-600">
              ฿{formatPrice(totalPrice)}
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
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        ) : null}

        <button
          type="button"
          className="w-full rounded-full bg-emerald-600 py-3 text-base font-semibold text-white shadow-md transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {detail.button} · ฿{formatPrice(totalPrice)}
        </button>
      </aside>
    </div>
  );
}
