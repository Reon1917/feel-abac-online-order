import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import {
  SUPPORTED_LOCALES,
  MENU_LOCALE_COOKIE_NAME,
  type Locale,
} from "@/lib/i18n/config";
import { MenuLocaleProvider } from "@/components/i18n/menu-locale-provider";
import { mapToSupportedLocale } from "@/lib/i18n/utils";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{
    lang: string;
  }>;
};

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  let menuLocale: Locale = locale;
  try {
    const cookieStore = await cookies();
    const rawValue = cookieStore.get(MENU_LOCALE_COOKIE_NAME)?.value;
    const cookieLocale = mapToSupportedLocale(rawValue);
    if (cookieLocale) {
      menuLocale = cookieLocale;
    }
  } catch {
    menuLocale = locale;
  }

  return (
    <MenuLocaleProvider initialLocale={menuLocale}>
      {children}
    </MenuLocaleProvider>
  );
}
