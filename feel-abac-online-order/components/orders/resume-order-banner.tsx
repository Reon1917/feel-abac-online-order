'use client';

import { useState } from "react";
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
  const [displayId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("lastOrderDisplayId");
    } catch {
      return null;
    }
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("resumeOrderDismissed") === "true";
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("resumeOrderDismissed", "true");
    } catch {
      // ignore
    }
  };

  if (!displayId || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 sm:right-6 sm:left-auto sm:max-w-sm">
      <div className="flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-lg shadow-emerald-100">
        <button
          type="button"
          onClick={handleDismiss}
          className="h-8 w-8 rounded-full text-slate-500 transition hover:bg-emerald-100"
          aria-label="Dismiss"
        >
          ×
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {dictionary.title}
          </p>
          <p className="text-[11px] text-emerald-700">{dictionary.subtitle}</p>
        </div>
        <Link
          href={withLocalePath(locale, `/orders/${displayId}`)}
          className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-700"
        >
          {dictionary.cta}
        </Link>
      </div>
    </div>
  );
}
