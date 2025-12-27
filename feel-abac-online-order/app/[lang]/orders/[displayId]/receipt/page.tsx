import { redirect } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type PageProps = {
  params: Promise<{
    lang: string;
    displayId: string;
  }>;
};

export default async function OrderReceiptPage({ params }: PageProps) {
  const { lang, displayId } = await params;
  const locale = lang as Locale;

  redirect(withLocalePath(locale, `/orders/${displayId}`));
}
