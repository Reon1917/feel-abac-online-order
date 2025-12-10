"use client";

import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";

type AdminHeaderProps = {
  locale: Locale;
  title: string;
  subtitle?: string;
  languageLabels: {
    label: string;
    english: string;
    burmese: string;
  };
  actions?: React.ReactNode;
};

export function AdminHeader({
  locale,
  title,
  subtitle,
  languageLabels,
  actions,
}: AdminHeaderProps) {

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4 lg:px-8">
      {/* Title Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <UiLanguageSwitcher locale={locale} labels={languageLabels} />
          {actions}
        </div>
      </div>
    </header>
  );
}
