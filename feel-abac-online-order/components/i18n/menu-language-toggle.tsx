"use client";

import * as React from "react";
import clsx from "clsx";
import { Languages } from "lucide-react";

import { MENU_LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/config";
import { useMenuLocale } from "./menu-locale-provider";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type MenuLanguageToggleProps = {
  labels: {
    label: string;
    english: string;
    burmese: string;
  };
  className?: string;
  hideLabel?: boolean;
  dropdownAlign?: "start" | "end";
};

export function MenuLanguageToggle({
  labels,
  className,
  hideLabel = false,
  dropdownAlign = "end",
}: MenuLanguageToggleProps) {
  const { menuLocale, setMenuLocale } = useMenuLocale();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const handleChange = (value: string) => {
    if (value !== "en" && value !== "my") {
      return;
    }
    const nextLocale = value as Locale;
    if (nextLocale === menuLocale) {
      setOpen(false);
      return;
    }

    startTransition(() => {
      setMenuLocale(nextLocale);
      document.cookie = `${MENU_LOCALE_COOKIE_NAME}=${nextLocale};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
      setOpen(false);
    });
  };

  const options: Array<{ value: Locale; label: string }> = [
    { value: "en", label: labels.english },
    { value: "my", label: labels.burmese },
  ];

  const activeLabel =
    menuLocale === "en" ? labels.english : labels.burmese;

  return (
    <div className={className}>
      <label
        className={clsx(
          "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500",
          hideLabel && "sr-only"
        )}
      >
        {labels.label}
      </label>
      <div className="relative inline-block text-left">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={isPending}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{activeLabel}</span>
          <span className="sm:hidden">{menuLocale.toUpperCase()}</span>
          <span className="sr-only">{labels.label}</span>
        </button>

        {open ? (
          <ul
            role="listbox"
            aria-label={labels.label}
            className={clsx(
              "absolute z-50 mt-2 min-w-40 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg",
              dropdownAlign === "end" ? "right-0" : "left-0"
            )}
          >
            {options.map((option) => {
              const isActive = option.value === menuLocale;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={isPending && isActive}
                    onClick={() => handleChange(option.value)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span>{option.label}</span>
                    {isActive ? (
                      <span className="text-xs font-bold uppercase text-emerald-600">
                        {option.value.toUpperCase()}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
