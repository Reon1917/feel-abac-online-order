"use client";

import * as React from "react";
import { MENU_LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/config";
import { useMenuLocale } from "./menu-locale-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type MenuLanguageToggleProps = {
  labels: {
    label: string;
    english: string;
    burmese: string;
  };
  className?: string;
};

export function MenuLanguageToggle({ labels, className }: MenuLanguageToggleProps) {
  const { menuLocale, setMenuLocale } = useMenuLocale();
  const [isPending, startTransition] = React.useTransition();

  const handleChange = (value: string) => {
    if (value !== "en" && value !== "my") {
      return;
    }
    const nextLocale = value as Locale;
    if (nextLocale === menuLocale) {
      return;
    }

    startTransition(() => {
      setMenuLocale(nextLocale);
      document.cookie = `${MENU_LOCALE_COOKIE_NAME}=${nextLocale};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
    });
  };

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {labels.label}
      </label>
      <Select value={menuLocale} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-44">
          <SelectValue>
            {menuLocale === "en" ? labels.english : labels.burmese}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{labels.english}</SelectItem>
          <SelectItem value="my">{labels.burmese}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
