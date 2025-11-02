"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import styles from "./mobile-menu.module.css";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";

type MobileMenuBrowserProps = {
  categories: PublicMenuCategory[];
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MobileMenuBrowser({ categories }: MobileMenuBrowserProps) {
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
    const allLabel = locale === "mm" ? "အားလုံး" : "All";

    return [
      { id: "all", name: allLabel },
      ...categories.map(({ id, name, nameMm }) => ({
        id,
        name: localize(name, nameMm),
      })),
    ];
  }, [categories, locale, localize]);

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
        <h1 className={styles.headerTitle}>Discover the menu</h1>
        <p className={styles.headerSubtitle}>
          Tailored for your screen. Search, filter, and add dishes in just a few taps.
        </p>
      </header>

      <div className={styles.controlRow}>
        <label className={styles.searchField}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search dishes or notes..."
            className={styles.searchInput}
          />
        </label>

        <div className={styles.localeToggle}>
          <div className={styles.localeButtonGroup}>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={clsx(styles.localeButton, {
                [styles.localeButtonActive]: locale === "en",
              })}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale("mm")}
              className={clsx(styles.localeButton, {
                [styles.localeButtonActive]: locale === "mm",
              })}
            >
              Burmese
            </button>
          </div>
        </div>

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
          <div className={styles.emptyState}>
            Nothing matches your search yet. Try a different term or category.
          </div>
        ) : (
          <ul className={styles.listRoot}>
            {filteredItems.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <MobileMenuListItem item={item} locale={locale} />
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
  locale: "en" | "mm";
};

function MobileMenuListItem({ item, locale }: MobileMenuCardProps) {
  const displayName = locale === "mm" ? item.nameMm ?? item.name : item.name;
  const descriptionCopy = item.description
    ? locale === "mm"
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

