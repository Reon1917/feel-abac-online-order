"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories.flatMap((category) => {
      if (activeCategory !== "all" && category.id !== activeCategory) {
        return [] as PublicMenuItem[];
      }

      return category.items.filter((item) => {
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
        {filteredItems.length === 0 ? (
          <div className={styles.emptyState}>{browser.empty}</div>
        ) : (
          <ul className={styles.listRoot}>
            {filteredItems.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <MobileMenuListItem item={item} locale={menuLocale} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type MobileMenuCardProps = {
  item: PublicMenuItem;
  locale: Locale;
};

function MobileMenuListItem({ item, locale }: MobileMenuCardProps) {
  const displayName = locale === "my" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy = item.description
    ? locale === "my"
      ? item.descriptionMm ?? item.description
      : item.description
    : null;

  return (
    <div className={styles.listInner}>
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
          <button type="button" className={styles.addButton}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

