"use client";

import { Menu } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { useSidebar } from "@/components/admin/admin-sidebar-context";

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
  const { toggleMobile } = useSidebar();

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4 lg:px-8">
      {/* Title Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={toggleMobile}
            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 md:hidden"
            aria-label="Toggle admin menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <UiLanguageSwitcher
            locale={locale}
            labels={languageLabels}
            className="**:data-[slot='select-trigger']:text-slate-900 **:data-[slot='select-value']:text-slate-900"
          />
          {actions}
        </div>
      </div>
    </header>
  );
}
