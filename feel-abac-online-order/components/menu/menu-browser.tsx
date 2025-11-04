"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { Locale } from "@/lib/i18n/config";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type MenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MenuBrowser({ categories, layout = "default", dictionary, common }: MenuBrowserProps) {
  const isCompact = layout === "compact";
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { menuLocale } = useMenuLocale();
  const { browser } = dictionary;

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (menuLocale === "my" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [menuLocale]
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories.flatMap((category) => {
      if (activeCategory !== "all" && category.id !== activeCategory) {
        return [] as PublicMenuItem[];
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
        .map((item) => item);
    });
  }, [activeCategory, categories, searchTerm]);

  const categoryTabs = useMemo(() => {
    const allLabel = browser.categoryAll;
    return [
      { id: "all", name: allLabel },
      ...categories.map(({ id, name, nameMm }) => ({
        id,
        name: localize(name, nameMm),
      })),
    ];
  }, [browser.categoryAll, categories, localize]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            {browser.title}
          </h1>
          <p className="text-sm text-slate-600">{browser.subtitle}</p>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 focus-within:border-emerald-300">
            <span className="text-base">🔍</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={browser.searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <MenuLanguageToggle
              labels={common.menuLanguageToggle}
              className="sm:min-w-[12rem]"
            />
            <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="flex flex-col gap-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {browser.empty}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <MenuItemRow
                  item={item}
                  locale={menuLocale}
                  compact={isCompact}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  locale,
  compact,
}: {
  item: PublicMenuItem;
  locale: Locale;
  compact?: boolean;
}) {
  const isCompact = !!compact;
  const displayName = locale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy = locale === "my" ? item.descriptionMm ?? item.description : item.description;

  return (
    <article className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={clsx("relative overflow-hidden rounded-md bg-slate-100", isCompact ? "h-16 w-24" : "h-20 w-28", "shrink-0")}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 40vw, 200px"
            priority={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {item.placeholderIcon ?? "🍽️"}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-relaxed text-slate-900 line-clamp-2">
            {displayName}
          </h3>
          {item.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500 line-clamp-2">
              {descriptionCopy}
            </p>
          )}
        </div>

        <div className="ml-4 flex flex-col items-end gap-2">
          <span className="text-lg font-bold text-emerald-600">
            ฿{formatPrice(item.price)}
          </span>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            + Add
          </button>
        </div>
      </div>
    </article>
  );
}
