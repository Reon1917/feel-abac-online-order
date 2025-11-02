"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { PublicMenuCategory, PublicMenuItem } from "@/lib/menu/types";

type MenuBrowserProps = {
  categories: PublicMenuCategory[];
  layout?: "default" | "compact";
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MenuBrowser({ categories, layout = "default" }: MenuBrowserProps) {
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

      <div
        className={clsx(
          "grid gap-4 max-[360px]:grid-cols-1",
          layout === "compact"
            ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {filteredItems.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nothing matches your search yet. Try a different term or category.
          </div>
        ) : (
          filteredItems.map((item) => (
            <MenuItemCard key={item.id} item={item} locale={locale} />
          ))
        )}
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  locale,
}: {
  item: PublicMenuItem;
  locale: "en" | "mm";
}) {
  const displayName =
    locale === "mm" ? item.nameMm ?? item.name : item.name;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      {/* Image - upper half */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {item.imageUrl ? (
          <div className="relative h-full w-full">
            <Image
              src={item.imageUrl}
              alt={displayName}
              fill
              className="object-cover transition group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
              priority={false}
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            {item.placeholderIcon ?? "🍽️"}
          </div>
        )}
      </div>

      {/* Content - lower half */}
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
          {displayName}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-emerald-600">
            ฿{formatPrice(item.price)}
          </span>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            + Add
          </button>
        </div>
      </div>
    </article>
  );
}
