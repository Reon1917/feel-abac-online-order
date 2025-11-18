"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { LayoutGrid, List, Search } from "lucide-react";
import {
  PublicMenuCategory,
  PublicMenuItem,
  PublicRecommendedMenuItem,
} from "@/lib/menu/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import type { QuickAddHandler } from "./use-quick-add";
import { useMenuImageCache } from "./menu-image-cache";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");
type ItemCountDictionary = NonNullable<MenuDictionary["browser"]["itemCount"]>;

type MenuBrowserProps = {
  categories: PublicMenuCategory[];
  recommended?: PublicRecommendedMenuItem[];
  layout?: "default" | "compact";
  dictionary: MenuDictionary;
  common: CommonDictionary;
  appLocale: Locale;
  onQuickAdd?: QuickAddHandler;
};

type DisplayCategory = {
  id: string;
  displayName: string;
  secondaryName?: string | null;
  items: PublicMenuItem[];
  itemCountLabel: string;
};

type SearchableItem = {
  record: PublicMenuItem;
  searchText: string;
};

type SearchableCategory = {
  id: string;
  displayName: string;
  secondaryName?: string | null;
  searchableItems: SearchableItem[];
};

const INITIAL_CATEGORY_BATCH = 3;
const CATEGORY_BATCH_SIZE = 2;

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MenuBrowser({
  categories,
  recommended = [],
  layout = "default",
  dictionary,
  common,
  appLocale,
  onQuickAdd,
}: MenuBrowserProps) {
  const [viewMode, setViewMode] = useState<MenuBrowserProps["layout"]>(layout);
  const isCompact = viewMode === "compact";
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(
    INITIAL_CATEGORY_BATCH
  );
  const { menuLocale } = useMenuLocale();
  const { browser } = dictionary;
  const outOfStockLabel = browser.outOfStock ?? "Out of stock";
  const pluralRules = useMemo(() => new Intl.PluralRules(menuLocale), [menuLocale]);
  const deferredSearch = useDeferredValue(searchTerm);

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (menuLocale === "my" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [menuLocale]
  );

  const resetVisibleCategories = useCallback(() => {
    setVisibleCategoryCount(INITIAL_CATEGORY_BATCH);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      resetVisibleCategories();
    },
    [resetVisibleCategories]
  );

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      setActiveCategory(categoryId);
      resetVisibleCategories();
    },
    [resetVisibleCategories]
  );

  const searchableCategories = useMemo<SearchableCategory[]>(() => {
    return categories.map((category) => {
      const displayName = localize(category.name, category.nameMm);
      const secondaryCandidate =
        menuLocale === "my" ? category.name ?? null : category.nameMm ?? null;
      const secondaryName =
        secondaryCandidate && secondaryCandidate !== displayName
          ? secondaryCandidate
          : null;

      const searchableItems = category.items.map<SearchableItem>((item) => ({
        record: item,
        searchText: [
          item.name,
          item.nameMm ?? "",
          item.description ?? "",
          item.descriptionMm ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      }));

      return {
        id: category.id,
        displayName,
        secondaryName,
        searchableItems,
      } satisfies SearchableCategory;
    });
  }, [categories, localize, menuLocale]);

  const normalizedQuery = deferredSearch.trim().toLowerCase();

  const filteredCategories = useMemo<DisplayCategory[]>(() => {
    return searchableCategories
      .map<DisplayCategory | null>((category) => {
        if (activeCategory !== "all" && category.id !== activeCategory) {
          return null;
        }

        const matchingItems = normalizedQuery
          ? category.searchableItems.filter((item) =>
              item.searchText.includes(normalizedQuery)
            )
          : category.searchableItems;

        if (matchingItems.length === 0) {
          return null;
        }

        const count = matchingItems.length;
        const pluralKey = pluralRules.select(count);
        const itemCountTemplates = browser.itemCount as ItemCountDictionary | undefined;
        const template =
          itemCountTemplates?.[pluralKey as keyof ItemCountDictionary] ??
          itemCountTemplates?.other ??
          "{{count}}";

        return {
          id: category.id,
          displayName: category.displayName,
          secondaryName: category.secondaryName,
          itemCountLabel: template.replace("{{count}}", String(count)),
          items: matchingItems.map((entry) => entry.record),
        } satisfies DisplayCategory;
      })
      .filter(Boolean) as DisplayCategory[];
  }, [activeCategory, browser.itemCount, normalizedQuery, pluralRules, searchableCategories]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (visibleCategoryCount >= filteredCategories.length) {
      return;
    }
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCategoryCount((prev) =>
            Math.min(
              filteredCategories.length,
              prev + CATEGORY_BATCH_SIZE
            )
          );
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredCategories.length, visibleCategoryCount]);

  const renderedCategories = filteredCategories.slice(
    0,
    visibleCategoryCount
  );

  const categoryTabs = useMemo(() => {
    const allLabel = browser.categoryAll;
    return [
      { id: "all", name: allLabel },
      ...searchableCategories.map((category) => ({
        id: category.id,
        name: category.displayName,
      })),
    ];
  }, [browser.categoryAll, searchableCategories]);

  const prioritizedItemId =
    renderedCategories[0]?.items[0]?.id ?? null;

  const recommendedDictionary = dictionary.recommendations;
  const showRecommendations =
    Boolean(recommendedDictionary) &&
    recommended.length > 0 &&
    normalizedQuery.length === 0 &&
    activeCategory === "all";

  return (
    <div className="space-y-10">
  <section className="sticky top-4 z-30 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-lg backdrop-blur supports-backdrop-filter:bg-white/75 sm:top-6 sm:p-6">
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
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={browser.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleCategoryChange(tab.id)}
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

      {showRecommendations && recommendedDictionary ? (
        <RecommendedItemsSection
          recommended={recommended}
          menuLocale={menuLocale}
          appLocale={appLocale}
          copy={recommendedDictionary}
          actionLabel={browser.viewDetails}
          outOfStockLabel={outOfStockLabel}
          onQuickAdd={onQuickAdd}
        />
      ) : null}

      <div>
        {filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm text-slate-500">
            {browser.empty}
          </div>
        ) : (
          <div className="space-y-12">
            {renderedCategories.map((category) => (
              <MenuCategorySection
                key={category.id}
                category={category}
                menuLocale={menuLocale}
                appLocale={appLocale}
                compact={isCompact}
                actionLabel={browser.viewDetails}
                outOfStockLabel={outOfStockLabel}
                priorityItemId={prioritizedItemId}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        )}
      </div>
      {visibleCategoryCount < filteredCategories.length ? (
        <div
          ref={loadMoreRef}
          aria-hidden="true"
          className="flex items-center justify-center py-6 text-sm text-slate-400"
        >
          {browser.loadingMore ?? "Loading…"}
        </div>
      ) : null}
    </div>
  );
}

type RecommendationCopy = NonNullable<MenuDictionary["recommendations"]>;

function RecommendedItemsSection({
  recommended,
  menuLocale,
  appLocale,
  copy,
  actionLabel,
  outOfStockLabel,
  onQuickAdd,
}: {
  recommended: PublicRecommendedMenuItem[];
  menuLocale: Locale;
  appLocale: Locale;
  copy: RecommendationCopy;
  actionLabel: string;
  outOfStockLabel: string;
  onQuickAdd?: QuickAddHandler;
}) {
  if (recommended.length === 0) {
    return null;
  }

  const fallbackBadge = copy.badgeDefault ?? "Chef's pick";

  return (
    <section className="space-y-5 rounded-3xl border border-emerald-100 bg-linear-to-br from-white via-emerald-25 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {copy.label ?? "Featured"}
          </span>
          <h2 className="text-2xl font-semibold text-slate-900">
            {copy.title}
          </h2>
          <p className="text-sm text-slate-600">{copy.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recommended.map((entry, index) => (
          <MenuItemCard
            key={entry.id}
            item={entry.item}
            menuLocale={menuLocale}
            appLocale={appLocale}
            actionLabel={actionLabel}
            outOfStockLabel={outOfStockLabel}
            priority={index === 0}
            variant="recommended"
            badgeLabel={entry.badgeLabel ?? fallbackBadge}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
    </section>
  );
}

function MenuCategorySection({
  category,
  menuLocale,
  appLocale,
  compact,
  actionLabel,
  outOfStockLabel,
  priorityItemId = null,
  onQuickAdd,
}: {
  category: DisplayCategory;
  menuLocale: Locale;
  appLocale: Locale;
  compact?: boolean;
  actionLabel: string;
  outOfStockLabel: string;
  priorityItemId?: string | null;
  onQuickAdd?: QuickAddHandler;
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
                menuLocale={menuLocale}
                appLocale={appLocale}
                actionLabel={actionLabel}
                outOfStockLabel={outOfStockLabel}
                priority={priorityItemId === item.id}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {category.items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                menuLocale={menuLocale}
                appLocale={appLocale}
                actionLabel={actionLabel}
                outOfStockLabel={outOfStockLabel}
                priority={priorityItemId === item.id}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
      )}
    </section>
  );
}

function MenuItemCard({
  item,
  menuLocale,
  appLocale,
  actionLabel,
  outOfStockLabel,
  priority,
  variant = "default",
  badgeLabel,
  onQuickAdd,
}: {
  item: PublicMenuItem;
  menuLocale: Locale;
  appLocale: Locale;
  actionLabel: string;
  outOfStockLabel: string;
  priority?: boolean;
  variant?: "default" | "recommended";
  badgeLabel?: string | null;
  onQuickAdd?: QuickAddHandler;
}) {
  const detailHref = withLocalePath(appLocale, `/menu/items/${item.id}`);
  const displayName = menuLocale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    menuLocale === "my"
      ? item.descriptionMm ?? item.description
      : item.description;
  const isOutOfStock = !item.isAvailable;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const buttonDisabled = isOutOfStock || !onQuickAdd;
  const { isFirstInstance } = useMenuImageCache(item.imageUrl);
  const shouldPreloadImage = Boolean(priority || isFirstInstance);
  const badgeText =
    typeof badgeLabel === "string" && badgeLabel.trim().length > 0
      ? badgeLabel.trim()
      : null;
  const imageHeightClass =
    variant === "recommended" ? "h-44 sm:h-52" : "h-36 sm:h-40";
  const descriptionClampClass =
    variant === "recommended"
      ? "line-clamp-2 min-h-[2.75rem]"
      : "line-clamp-3";

  const cardContent = (
    <article
      className={clsx(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition duration-200",
        isOutOfStock
          ? "border-slate-200 opacity-70 grayscale"
          : variant === "recommended"
            ? "border-emerald-100 bg-linear-to-b from-white via-emerald-50/40 to-white group-hover:border-emerald-200 group-hover:shadow-lg"
            : "border-slate-200 bg-white group-hover:-translate-y-1 group-hover:border-emerald-300 group-hover:shadow-lg"
      )}
    >
      <div className={clsx("relative w-full overflow-hidden bg-emerald-50", imageHeightClass)}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className={clsx(
              "object-cover transition duration-500",
              !isOutOfStock && "group-hover:scale-105"
            )}
            sizes="(max-width: 768px) 100vw, 400px"
            priority={shouldPreloadImage}
            loading={shouldPreloadImage ? "eager" : undefined}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {item.placeholderIcon ?? "🍽️"}
          </div>
        )}
        {badgeText ? (
          <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 shadow">
            {badgeText}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{displayName}</h3>
          {descriptionCopy ? (
            <p
              className={clsx(
                "text-sm leading-relaxed text-slate-600",
                descriptionClampClass
              )}
            >
              {descriptionCopy}
            </p>
          ) : variant === "recommended" ? (
            <p className="text-sm text-slate-500 opacity-0">.</p>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="text-base font-semibold text-emerald-600 sm:text-lg">
            ฿{formatPrice(item.price)}
          </span>
          <button
            ref={addButtonRef}
            type="button"
            aria-label={actionLabel}
            aria-disabled={buttonDisabled}
            className={clsx(
              "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-emerald-600 shadow ring-1 ring-emerald-100 transition sm:h-9 sm:w-9 sm:text-xl",
              !isOutOfStock && "group-hover:bg-emerald-600 group-hover:text-white",
              buttonDisabled && "cursor-default opacity-60"
            )}
            onClick={(event) => {
              if (buttonDisabled || !onQuickAdd) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const rect = addButtonRef.current?.getBoundingClientRect() ?? null;
              onQuickAdd({
                item,
                rect,
                detailHref,
              });
            }}
          >
            +
          </button>
        </div>
      </div>

      {isOutOfStock ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/85 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {outOfStockLabel}
        </div>
      ) : null}
    </article>
  );

  if (isOutOfStock) {
    return (
      <div className="group block h-full cursor-not-allowed" aria-disabled="true">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      prefetch={false}
      href={detailHref}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
    >
      {cardContent}
    </Link>
  );
}

function MenuItemRow({
  item,
  menuLocale,
  appLocale,
  actionLabel,
  outOfStockLabel,
  priority,
  onQuickAdd,
}: {
  item: PublicMenuItem;
  menuLocale: Locale;
  appLocale: Locale;
  actionLabel: string;
  outOfStockLabel: string;
  priority?: boolean;
  onQuickAdd?: QuickAddHandler;
}) {
  const detailHref = withLocalePath(appLocale, `/menu/items/${item.id}`);
  const displayName = menuLocale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    menuLocale === "my"
      ? item.descriptionMm ?? item.description
      : item.description;

  const isOutOfStock = !item.isAvailable;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const buttonDisabled = isOutOfStock || !onQuickAdd;
  const { isFirstInstance } = useMenuImageCache(item.imageUrl);
  const shouldPreloadImage = Boolean(priority || isFirstInstance);

  const rowContent = (
    <article
      className={clsx(
        "relative flex items-start gap-3 rounded-2xl border bg-white p-3 shadow-sm transition sm:gap-4 sm:p-4",
        isOutOfStock
          ? "border-slate-200 opacity-70 grayscale"
          : "border-slate-200 group-hover:border-emerald-300 group-hover:shadow-md"
      )}
    >
      <div className="relative h-20 w-24 overflow-hidden rounded-xl bg-emerald-50 sm:w-28">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 40vw, 200px"
            priority={shouldPreloadImage}
            loading={shouldPreloadImage ? "eager" : undefined}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {item.placeholderIcon ?? "🍽️"}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
            {displayName}
          </h3>
          {descriptionCopy ? (
            <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
              {descriptionCopy}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <span className="text-base font-semibold text-emerald-600 sm:text-lg">
            ฿{formatPrice(item.price)}
          </span>
          <button
            ref={addButtonRef}
            type="button"
            aria-label={actionLabel}
            aria-disabled={buttonDisabled}
            className={clsx(
              "inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-base font-bold text-emerald-600 shadow ring-1 ring-emerald-100 transition sm:h-8 sm:w-8 sm:text-lg",
              !isOutOfStock && "group-hover:bg-emerald-600 group-hover:text-white",
              buttonDisabled && "cursor-default opacity-60"
            )}
            onClick={(event) => {
              if (buttonDisabled || !onQuickAdd) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const rect = addButtonRef.current?.getBoundingClientRect() ?? null;
              onQuickAdd({
                item,
                rect,
                detailHref,
              });
            }}
          >
            +
          </button>
        </div>
      </div>

      {isOutOfStock ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/85 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {outOfStockLabel}
        </div>
      ) : null}
    </article>
  );

  if (isOutOfStock) {
    return (
      <div className="group block cursor-not-allowed" aria-disabled="true">
        {rowContent}
      </div>
    );
  }

  return (
    <Link
      prefetch={false}
      href={detailHref}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
    >
      {rowContent}
    </Link>
  );
}
