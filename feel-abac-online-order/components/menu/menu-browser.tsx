"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { LayoutGrid, List } from "lucide-react";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { Locale } from "@/lib/i18n/config";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");
type ItemCountDictionary = NonNullable<MenuDictionary["browser"]["itemCount"]>;

type MenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
};

type DisplayCategory = {
  id: string;
  displayName: string;
  secondaryName?: string | null;
  items: PublicMenuItem[];
  itemCountLabel: string;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MenuBrowser({ categories, layout = "default", dictionary, common }: MenuBrowserProps) {
  const [viewMode, setViewMode] = useState<MenuBrowserProps["layout"]>(layout);
  const isCompact = viewMode === "compact";
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { menuLocale } = useMenuLocale();
  const { browser } = dictionary;
  const pluralRules = useMemo(() => new Intl.PluralRules(menuLocale), [menuLocale]);

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (menuLocale === "my" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [menuLocale]
  );

  const filteredCategories = useMemo<DisplayCategory[]>(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories
      .map<DisplayCategory | null>((category) => {
        if (activeCategory !== "all" && category.id !== activeCategory) {
          return null;
        }

        const items = category.items.filter((item) => {
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
        });

        if (items.length === 0) {
          return null;
        }

        const displayName = localize(category.name, category.nameMm);
        const secondaryName =
          menuLocale === "my" ? category.name ?? null : category.nameMm ?? null;
        return {
          id: category.id,
          displayName,
          secondaryName:
            secondaryName && secondaryName !== displayName ? secondaryName : null,
          itemCountLabel: (() => {
            const count = items.length;
            const pluralKey = pluralRules.select(count);
            const itemCountTemplates = browser.itemCount as ItemCountDictionary | undefined;
            const template =
              itemCountTemplates?.[pluralKey as keyof ItemCountDictionary] ??
              itemCountTemplates?.other ??
              "{{count}}";
            return template.replace("{{count}}", String(count));
          })(),
          items,
        };
      })
      .filter(Boolean) as DisplayCategory[];
  }, [activeCategory, browser.itemCount, categories, localize, menuLocale, pluralRules, searchTerm]);

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
    <div className="space-y-10">
      <section className="relative rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
  <div className="absolute right-4 top-6 flex items-center sm:right-6">
          <span className="sr-only">{browser.viewLabel}</span>
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("default")}
              aria-label={browser.viewCards}
              aria-pressed={viewMode === "default"}
              className={clsx(
                "rounded-full p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                viewMode === "default"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-500 hover:bg-emerald-50"
              )}
            >
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{browser.viewCards}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              aria-label={browser.viewList}
              aria-pressed={viewMode === "compact"}
              className={clsx(
                "rounded-full p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                viewMode === "compact"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-500 hover:bg-emerald-50"
              )}
            >
              <List className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{browser.viewList}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">
              {browser.title}
            </h1>
            <p className="text-sm text-slate-600">{browser.subtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <MenuLanguageToggle
              labels={common.menuLanguageToggle}
              className="w-full max-w-xs"
            />
          </div>
        </div>

        <label className="mt-6 flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm shadow-inner transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
          <span className="text-base">🔍</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={browser.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              aria-pressed={activeCategory === tab.id}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                activeCategory === tab.id
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              )}
              type="button"
            >
              {tab.name}
            </button>
          ))}
        </div>
      </section>

      <div>
        {filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm text-slate-500">
            {browser.empty}
          </div>
        ) : (
          <div className="space-y-12">
            {filteredCategories.map((category) => (
              <MenuCategorySection
                key={category.id}
                category={category}
                locale={menuLocale}
                compact={isCompact}
                actionLabel={browser.viewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuCategorySection({
  category,
  locale,
  compact,
  actionLabel,
}: {
  category: DisplayCategory;
  locale: Locale;
  compact?: boolean;
  actionLabel: string;
}) {
  const isCompact = !!compact;
  const itemCountLabel = category.itemCountLabel;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {category.displayName}
          </h2>
          {category.secondaryName ? (
            <p className="text-sm text-slate-500">{category.secondaryName}</p>
          ) : null}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {itemCountLabel}
        </span>
      </div>

      {isCompact ? (
        <div className="space-y-3">
          {category.items.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              locale={locale}
              actionLabel={actionLabel}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {category.items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              locale={locale}
              actionLabel={actionLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MenuItemCard({
  item,
  locale,
  actionLabel,
}: {
  item: PublicMenuItem;
  locale: Locale;
  actionLabel: string;
}) {
  const detailHref = `/${locale}/menu/items/${item.id}`;
  const displayName = locale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    locale === "my"
      ? item.descriptionMm ?? item.description
      : item.description;

  return (
    <Link
      href={detailHref}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
    >
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:border-emerald-300 group-hover:shadow-lg">
        <div className={clsx("relative w-full overflow-hidden bg-emerald-50", "h-40")}>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={displayName}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 400px"
              priority={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">
              {item.placeholderIcon ?? "🍽️"}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">{displayName}</h3>
            {descriptionCopy ? (
              <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
                {descriptionCopy}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between gap-3">
            <span className="text-lg font-semibold text-emerald-600">
              ฿{formatPrice(item.price)}
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl font-bold text-emerald-600 shadow ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white">
              +
              <span className="sr-only">{actionLabel}</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function MenuItemRow({
  item,
  locale,
  actionLabel,
}: {
  item: PublicMenuItem;
  locale: Locale;
  actionLabel: string;
}) {
  const detailHref = `/${locale}/menu/items/${item.id}`;
  const displayName = locale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    locale === "my"
      ? item.descriptionMm ?? item.description
      : item.description;

  return (
    <Link
      href={detailHref}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
    >
      <article className="relative flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition group-hover:border-emerald-300 group-hover:shadow-md">
        <div className="relative h-20 w-28 overflow-hidden rounded-xl bg-emerald-50">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 40vw, 200px"
              priority={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">
              {item.placeholderIcon ?? "🍽️"}
            </div>
          )}
        </div>

        <div className="flex flex-1 items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              {displayName}
            </h3>
            {descriptionCopy ? (
              <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
                {descriptionCopy}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
            <span className="text-lg font-semibold text-emerald-600">
              ฿{formatPrice(item.price)}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-emerald-600 shadow ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white">
              +
              <span className="sr-only">{actionLabel}</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
