"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import {
  PublicMenuCategory,
  PublicMenuChoiceGroup,
  PublicMenuItem,
} from "@/lib/menu/types";

type MenuBrowserProps = {
  categories: PublicMenuCategory[];
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MenuBrowser({ categories }: MenuBrowserProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
   const [locale, setLocale] = useState<"en" | "mm">("en");

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (locale === "mm" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [locale]
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories.flatMap((category) => {
      if (activeCategory !== "all" && category.id !== activeCategory) {
        return [] as Array<{
          item: PublicMenuItem;
          categoryId: string;
          categoryNameEn: string;
          categoryNameMm: string | null;
        }>;
      }

      return category.items
        .filter((item) => {
          if (!query) return true;
          const haystack = [
            item.name,
            item.nameMm ?? "",
            item.description ?? "",
            item.descriptionMm ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
        .map((item) => ({
          item,
          categoryId: category.id,
          categoryNameEn: category.name,
          categoryNameMm: category.nameMm ?? null,
        }));
    });
  }, [activeCategory, categories, searchTerm]);

  const categoryTabs = useMemo(() => {
    const allLabel = locale === "mm" ? "အားလုံး" : "All";
    return [
      { id: "all", name: allLabel },
      ...categories.map(({ id, name, nameMm }) => ({
        id,
        name: localize(name, nameMm),
      })),
    ];
  }, [categories, locale, localize]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">Discover the menu</h1>
          <p className="text-sm text-slate-600">
            Filter by category or search by name. Base prices are shown in Thai Baht; options update the total dynamically.
          </p>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 focus-within:border-emerald-300">
            <span className="text-base">🔍</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search dishes or notes..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={clsx(
                  "rounded-sm px-3 py-1 transition",
                  locale === "en"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-emerald-600"
                )}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLocale("mm")}
                className={clsx(
                  "rounded-sm px-3 py-1 transition",
                  locale === "mm"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-emerald-600"
                )}
              >
                Burmese
              </button>
            </div>
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={clsx(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition sm:text-sm",
                  activeCategory === tab.id
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                )}
                type="button"
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nothing matches your search yet. Try a different term or category.
          </div>
        ) : (
          filteredItems.map(({ item, categoryNameEn, categoryNameMm }) => (
            <MenuItemCard
              key={item.id}
              item={item}
              categoryNameEn={categoryNameEn}
              categoryNameMm={categoryNameMm}
              locale={locale}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  categoryNameEn,
  categoryNameMm,
  locale,
}: {
  item: PublicMenuItem;
  categoryNameEn: string;
  categoryNameMm: string | null;
  locale: "en" | "mm";
}) {
  const [notes, setNotes] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    item.choiceGroups.forEach((group) => {
      initial[group.id] = [];
    });
    return initial;
  });

  const optionPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    item.choiceGroups.forEach((group) => {
      group.options.forEach((option) => {
        map.set(option.id, option.extraPrice);
      });
    });
    return map;
  }, [item.choiceGroups]);

  const totalPrice = useMemo(() => {
    const base = item.price;
    const extras = Object.values(selectedOptions).flat();
    const extraTotal = extras.reduce((acc, optionId) => {
      const extra = optionPriceMap.get(optionId) ?? 0;
      return acc + extra;
    }, 0);
    return base + extraTotal;
  }, [item.price, optionPriceMap, selectedOptions]);

  const categoryLabel =
    locale === "mm"
      ? categoryNameMm ?? categoryNameEn
      : categoryNameEn;
  const displayName =
    locale === "mm" ? item.nameMm ?? item.name : item.name;
  const description =
    locale === "mm"
      ? item.descriptionMm ?? item.description ?? "—"
      : item.description ?? item.descriptionMm ?? "—";
  const baseLabel = locale === "mm" ? "အခြေခံ" : "Base";
  const notesLabel = locale === "mm" ? "အထူးမှတ်ချက်" : "Special notes";
  const notesPlaceholder =
    locale === "mm"
      ? "ဥပမာ - ဆီနည်း၊ အစပ်နည်း"
      : "Let us know if you prefer less spicy, extra sauce, etc.";
  const addButtonLabel = locale === "mm" ? "အော်ဒါထည့်ရန်" : "Add to tray";

  const handleSelect = (
    group: PublicMenuChoiceGroup,
    optionId: string,
    checked: boolean
  ) => {
    setSelectedOptions((prev) => {
      const existing = prev[group.id] ?? [];
      if (group.maxSelect === 1) {
        return {
          ...prev,
          [group.id]: checked ? [optionId] : [],
        };
      }

      if (!checked) {
        return {
          ...prev,
          [group.id]: existing.filter((id) => id !== optionId),
        };
      }

      if (existing.includes(optionId)) {
        return prev;
      }

      if (existing.length >= group.maxSelect) {
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...existing, optionId],
      };
    });
  };

  return (
    <article className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              {categoryLabel}
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              {displayName}
            </h2>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <div className="size-16 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={displayName}
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl">
                {item.placeholderIcon ?? "🍽️"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-emerald-700">
            ฿{formatPrice(totalPrice)}
          </span>
          <span className="text-xs text-slate-500">
            {baseLabel} ฿{formatPrice(item.price)}
          </span>
        </div>
      </div>

      {item.choiceGroups.length > 0 && (
        <div className="space-y-4">
          {item.choiceGroups.map((group) => (
            <fieldset key={group.id} className="space-y-3">
              <legend className="text-sm font-semibold text-slate-900">
                {locale === "mm"
                  ? group.titleMm ?? group.title
                  : group.title}
              </legend>
              <p className="text-xs text-slate-500">
                {group.isRequired ? "Required" : "Optional"} · choose{" "}
                {group.minSelect === group.maxSelect
                  ? group.maxSelect
                  : `${group.minSelect}-${group.maxSelect}`}
              </p>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const isChecked =
                    selectedOptions[group.id]?.includes(option.id) ?? false;
                  const isAtLimit =
                    (selectedOptions[group.id]?.length ?? 0) >= group.maxSelect &&
                    !isChecked &&
                    group.maxSelect > 1;

                  if (group.maxSelect === 1) {
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-emerald-300"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name={`group-${group.id}`}
                            value={option.id}
                            checked={isChecked}
                            onChange={(event) =>
                              handleSelect(group, option.id, event.target.checked)
                            }
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>
                            {locale === "mm"
                              ? option.nameMm ?? option.name
                              : option.name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {option.extraPrice > 0
                            ? `+฿${formatPrice(option.extraPrice)}`
                            : "Included"}
                        </span>
                      </label>
                    );
                  }

                  return (
                    <label
                      key={option.id}
                      className={clsx(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition",
                        isChecked
                          ? "border-emerald-400"
                          : "hover:border-emerald-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          value={option.id}
                          checked={isChecked}
                          disabled={isAtLimit}
                          onChange={(event) =>
                            handleSelect(group, option.id, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          {locale === "mm"
                            ? option.nameMm ?? option.name
                            : option.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {option.extraPrice > 0
                          ? `+฿${formatPrice(option.extraPrice)}`
                          : "Included"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {item.allowUserNotes && (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">
              {notesLabel}
            </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder={notesPlaceholder}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>
      )}

      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <span>+</span> {addButtonLabel}
      </button>
    </article>
  );
}
