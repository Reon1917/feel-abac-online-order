"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/config";
import { swapLocaleInPath } from "@/lib/i18n/path";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UiLanguageSwitcherProps = {
  locale: Locale;
  labels: {
    label: string;
    english: string;
    burmese: string;
  };
  className?: string;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function UiLanguageSwitcher({
  locale,
  labels,
  className,
}: UiLanguageSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocaleChange = (nextValue: string) => {
    if (!SUPPORTED_LOCALES.includes(nextValue as Locale)) return;
    const nextLocale = nextValue as Locale;
    if (nextLocale === locale) return;

    startTransition(() => {
      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
      const nextPath = swapLocaleInPath(pathname, nextLocale);
      const search = searchParams?.toString();
      const nextUrl = search ? `${nextPath}?${search}` : nextPath;
      router.replace(nextUrl);
      router.refresh();
    });
  };

  const activeLabel = locale === "en" ? labels.english : labels.burmese;

  if (!mounted) {
    return (
      <div className={className}>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {labels.label}
        </label>
        <div
          aria-hidden="true"
          className="h-9 w-40 rounded-md border border-slate-200 bg-white shadow-xs"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {labels.label}
      </label>
      <Select value={locale} onValueChange={handleLocaleChange} disabled={isPending}>
        <SelectTrigger className="w-40">
          <SelectValue aria-label={activeLabel}>{activeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{labels.english}</SelectItem>
          <SelectItem value="my">{labels.burmese}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
