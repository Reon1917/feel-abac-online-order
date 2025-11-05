"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

import styles from "./mobile-menu.module.css";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { Locale } from "@/lib/i18n/config";

type MenuDictionary = typeof import("@/dictionaries/en/menu.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type MobileMenuBrowserProps = {
  categories: PublicMenuCategory[];
  dictionary: MenuDictionary;
  common: CommonDictionary;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MobileMenuBrowser({ categories, dictionary, common }: MobileMenuBrowserProps) {
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

  return (
    <div className={styles.mobileRoot}>
      <header>
        <h1 className={styles.headerTitle}>{browser.title}</h1>
        <p className={styles.headerSubtitle}>{browser.mobileSubtitle}</p>
      </header>

      <div className={styles.controlRow}>
        <label className={styles.searchField}>
          <span className={styles.searchIcon}>🔍</span>
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
        {filteredCategories.length === 0 ? (
          <div className={styles.emptyState}>{browser.empty}</div>
        ) : (
          <div className={styles.listRoot}>
            {filteredCategories.map((category) => (
              <section key={category.id} className={styles.categorySection}>
                <h2 className={styles.categoryHeading}>{category.name}</h2>
                <ul className={styles.sectionList}>
                  {category.items.map((item) => (
                    <li key={item.id} className={styles.listItem}>
                      <MobileMenuListItem
                        item={item}
                        locale={menuLocale}
                        actionLabel={dictionary.browser.viewDetails}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type MobileMenuCardProps = {
  item: PublicMenuItem;
  locale: Locale;
  actionLabel: string;
};

function MobileMenuListItem({ item, locale, actionLabel }: MobileMenuCardProps) {
  const displayName = locale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy =
    locale === "my"
      ? item.descriptionMm ?? item.description ?? null
      : item.description ?? item.descriptionMm ?? null;
  const detailHref = `/${locale}/menu/items/${item.id}`;

  return (
    <Link href={detailHref} className={styles.listInner}>
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
          <span className={styles.addButton}>
            +
            <span className="sr-only">{actionLabel}</span>
          </span>
        </div>
      </div>
    </Link>

  );
}

