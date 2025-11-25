'use client';

import { useEffect, useState } from "react";
import Link from "next/link";

import type menuDictionary from "@/dictionaries/en/menu.json";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type MenuDictionary = typeof menuDictionary;

type Props = {
  locale: Locale;
  dictionary: MenuDictionary["resumeOrder"];
};

export function ResumeOrderBanner({ locale, dictionary }: Props) {
  const [displayId, setDisplayId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lastOrderDisplayId");
      if (stored) {
        setDisplayId(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!displayId) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-800">
            {dictionary.title}
          </p>
          <p className="text-xs text-emerald-700">{dictionary.subtitle}</p>
        </div>
        <Link
          href={withLocalePath(locale, `/orders/${displayId}`)}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          {dictionary.cta}
        </Link>
      </div>
    </div>
  );
}
