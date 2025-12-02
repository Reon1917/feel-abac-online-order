"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, ClipboardList, User } from "lucide-react";
import clsx from "clsx";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type MobileBottomNavProps = {
  locale: Locale;
  labels: {
    home: string;
    cart: string;
    orders: string;
    profile: string;
  };
};

export function MobileBottomNav({ locale, labels }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: withLocalePath(locale, "/menu"),
      icon: Home,
      label: labels.home,
      isActive: pathname.endsWith("/menu") || pathname.includes("/menu/items"),
    },
    {
      href: withLocalePath(locale, "/cart"),
      icon: ShoppingCart,
      label: labels.cart,
      isActive: pathname.endsWith("/cart"),
    },
    {
      href: withLocalePath(locale, "/orders"),
      icon: ClipboardList,
      label: labels.orders,
      isActive: pathname.includes("/orders"),
    },
    {
      href: withLocalePath(locale, "/profile"),
      icon: User,
      label: labels.profile,
      isActive: pathname.endsWith("/profile"),
    },
  ];

  return (
    <>
      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-lg sm:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  item.isActive
                    ? "text-emerald-600"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon
                  className={clsx(
                    "h-5 w-5",
                    item.isActive && "stroke-[2.5]"
                  )}
                />
                <span
                  className={clsx(
                    "text-[0.65rem] font-medium",
                    item.isActive && "font-semibold"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area padding for devices with home indicators */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Desktop side navigation */}
      <nav className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-40 sm:flex sm:w-20 lg:w-24 sm:flex-col sm:border-r sm:border-slate-200 sm:bg-white/95 sm:px-2 lg:px-3 sm:py-6 sm:shadow-lg">
        <div className="mt-16 flex flex-1 flex-col items-center gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors",
                  item.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                <Icon
                  className={clsx(
                    "h-5 w-5 lg:h-6 lg:w-6",
                    item.isActive && "stroke-[2.5]"
                  )}
                />
                <span className="text-[0.7rem] lg:text-[0.75rem]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
