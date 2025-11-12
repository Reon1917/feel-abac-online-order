"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import clsx from "clsx";
import { Search } from "lucide-react";

import styles from "./mobile-menu.module.css";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import type { QuickAddHandler } from "../use-quick-add";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type MobileMenuBrowserProps = {
  categories: PublicMenuCategory[];
  dictionary: MenuDictionary;
  common: CommonDictionary;
  appLocale: Locale;
  onQuickAdd?: QuickAddHandler;
};

const INITIAL_CATEGORY_BATCH = 4;
const CATEGORY_BATCH_SIZE = 3;

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MobileMenuBrowser({
  categories,
  dictionary,
  common,
  appLocale,
  onQuickAdd,
}: MobileMenuBrowserProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(
    INITIAL_CATEGORY_BATCH
  );
  const { menuLocale } = useMenuLocale();
  const { browser } = dictionary;
  const outOfStockLabel = browser.outOfStock ?? "Out of stock";
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const localize = useCallback(
    (en: string | null | undefined, mm?: string | null) => {
      if (menuLocale === "my" && mm && mm.trim().length > 0) {
        return mm;
      }
      return en ?? "";
    },
    [menuLocale]
  );

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories
      .map((category) => {
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

        return {
          id: category.id,
          name: localize(category.name, category.nameMm),
          items,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      items: PublicMenuItem[];
    }>;
  }, [activeCategory, categories, localize, searchTerm]);

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

  useEffect(() => {
    const availableIds = categoryTabs.map((tab) => tab.id);
    if (availableIds.includes(activeCategory)) {
      return;
    }

    let fallback = "";
    if (availableIds.includes("all")) {
      fallback = "all";
    } else if (availableIds.length > 0) {
      fallback = availableIds[0];
    }

    queueMicrotask(() => setActiveCategory(fallback));
  }, [activeCategory, categoryTabs]);

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

  return (
    <div className={styles.mobileRoot}>
      <header>
        <h1 className={styles.headerTitle}>{browser.title}</h1>
        <p className={styles.headerSubtitle}>{browser.mobileSubtitle}</p>
      </header>

      <div className={styles.controlRow}>
        <label className={styles.searchField}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={browser.searchPlaceholder}
            className={styles.searchInput}
          />
        </label>

        <MenuLanguageToggle
          labels={common.menuLanguageToggle}
          className="w-full"
        />

        <div className={styles.categoryList}>
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              type="button"
              className={clsx(styles.categoryButton, {
                [styles.categoryButtonActive]: activeCategory === tab.id,
              })}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        {renderedCategories.length === 0 ? (
          <div className={styles.emptyState}>{browser.empty}</div>
        ) : (
          <div className={styles.listRoot}>
            {renderedCategories.map((category) => (
              <section key={category.id} className={styles.categorySection}>
                <h2 className={styles.categoryHeading}>{category.name}</h2>
                <ul className={styles.sectionList}>
                  {category.items.map((item) => (
                    <li key={item.id} className={styles.listItem}>
                    <MobileMenuListItem
                      item={item}
                      menuLocale={menuLocale}
                      appLocale={appLocale}
                      actionLabel={dictionary.browser.viewDetails}
                      outOfStockLabel={outOfStockLabel}
                      onQuickAdd={onQuickAdd}
                    />
                  </li>
                ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {visibleCategoryCount < filteredCategories.length ? (
          <div
            ref={loadMoreRef}
            className={styles.lazyLoader}
            aria-hidden="true"
          >
            {dictionary.browser?.loadingMore ?? "Loading…"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type MobileMenuCardProps = {
  item: PublicMenuItem;
  menuLocale: Locale;
  appLocale: Locale;
  actionLabel: string;
  outOfStockLabel: string;
  onQuickAdd?: QuickAddHandler;
};

function MobileMenuListItem({
  item,
  menuLocale,
  appLocale,
  actionLabel,
  outOfStockLabel,
  onQuickAdd,
}: MobileMenuCardProps) {
  const displayName = menuLocale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    menuLocale === "my"
      ? item.descriptionMm ?? item.description ?? null
      : item.description ?? item.descriptionMm ?? null;
  const detailHref = withLocalePath(appLocale, `/menu/items/${item.id}`);
  const isOutOfStock = !item.isAvailable;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const buttonDisabled = isOutOfStock || !onQuickAdd;

  const content = (
    <>
      <div className={styles.listImage}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            sizes="(max-width: 600px) 40vw, 120px"
            className="object-cover"
          />
        ) : (
          <div className={styles.placeholderIcon}>{item.placeholderIcon ?? "🍽️"}</div>
        )}
      </div>

      <div className={styles.listContent}>
        <h3 className={styles.cardTitle}>{displayName}</h3>
        {descriptionCopy && <p className={styles.listDescription}>{descriptionCopy}</p>}
        <div className={styles.listFooter}>
          <span className={styles.price}>฿{formatPrice(item.price)}</span>
        </div>
      </div>
      <button
        ref={addButtonRef}
        type="button"
        className={clsx(styles.addButton, buttonDisabled && styles.addButtonDisabled)}
        aria-label={actionLabel}
        aria-disabled={buttonDisabled}
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
      {isOutOfStock ? (
        <div className={styles.outOfStockOverlay}>{outOfStockLabel}</div>
      ) : null}
    </>
  );

  if (isOutOfStock) {
    return (
      <div className={clsx(styles.listInner, styles.listInnerDisabled)} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link prefetch={false} href={detailHref} className={styles.listInner}>
      {content}
    </Link>
  );
}
