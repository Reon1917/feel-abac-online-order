"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  isRecommended?: boolean;
  isVegetarian?: boolean;
  emoji?: string;
  spiceLevel?: number;
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type MenuBrowserProps = {
  categories: MenuCategory[];
};

const spiceColor = ["bg-slate-200", "bg-emerald-200", "bg-emerald-300"];

export function MenuBrowser({ categories }: MenuBrowserProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories.flatMap((category) => {
      if (activeCategory !== "all" && category.id !== activeCategory) {
        return [] as Array<MenuItem & { categoryId: string; categoryName: string }>;
      }

      const items = category.items
        .filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
          );
        })
        .map((item) => ({
          ...item,
          categoryId: category.id,
          categoryName: category.name,
        }));

      return items;
    });
  }, [activeCategory, categories, searchTerm]);

  const categoryTabs = [{ id: "all", name: "All" }, ...categories.map(({ id, name }) => ({ id, name }))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">Menu preview</h1>
          <p className="text-sm text-slate-600">
            Browse the mock lineup while the real menu syncs with the kitchen.
            Refine by category or search for a dish.
          </p>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 focus-within:border-emerald-300">
            <span className="text-base">🔍</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search dishes..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
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
          filteredItems.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                    {item.categoryName}
                  </span>
                  <h2 className="text-lg font-semibold text-slate-900">{item.name}</h2>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
                <span className="text-3xl" aria-hidden>
                  {item.emoji ?? "🍽️"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-emerald-800">
                    {item.currency ?? "฿"}
                    {item.price}
                  </span>
                  {item.isVegetarian && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Veg friendly
                    </span>
                  )}
                  {typeof item.spiceLevel === "number" && item.spiceLevel > 0 && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <span
                          key={index}
                          className={clsx(
                            "h-1.5 w-4 rounded-full",
                            index < item.spiceLevel
                              ? spiceColor[Math.min(item.spiceLevel - 1, spiceColor.length - 1)]
                              : "bg-slate-200"
                          )}
                        />
                      ))}
                      <span className="text-xs text-slate-500">heat</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  <span>+</span>Add
                </button>
              </div>
              {item.isRecommended && (
                <div className="flex items-center justify-between rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                  <span className="font-semibold">Chef says go for it</span>
                  <span>⭐ Recommended</span>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}


