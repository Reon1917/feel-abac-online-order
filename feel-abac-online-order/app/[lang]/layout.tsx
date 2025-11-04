import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

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

  return <>{children}</>;
}

