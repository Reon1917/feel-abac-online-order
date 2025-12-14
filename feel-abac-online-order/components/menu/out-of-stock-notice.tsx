import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";
import type { PublicMenuItem } from "@/lib/menu/types";
import type { Locale } from "@/lib/i18n/config";

type OutOfStockNoticeProps = {
  item: PublicMenuItem;
  locale: Locale;
  backHref: string;
};

export function OutOfStockNotice({
  item,
  locale,
  backHref,
}: OutOfStockNoticeProps) {
  const isBurmese = locale === "my";

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <PackageX className="h-10 w-10 text-red-500" />
      </div>

      {/* Title */}
      <h1 className="mb-2 text-2xl font-bold text-slate-900">
        {isBurmese ? "ပစ္စည်းကုန်သွားပါပြီ" : "Sorry, This Item is Out of Stock"}
      </h1>

      {/* Item name */}
      <div className="mb-6 rounded-lg bg-slate-50 px-6 py-4">
        <p className="text-lg font-semibold text-slate-800">{item.name}</p>
        {item.nameMm && (
          <p className="mt-1 text-base text-slate-600">{item.nameMm}</p>
        )}
        {item.menuCode && (
          <p className="mt-2 text-sm text-slate-400">Code: {item.menuCode}</p>
        )}
      </div>

      {/* Message */}
      <p className="mb-8 max-w-sm text-slate-600">
        {isBurmese
          ? "ဤပစ္စည်းသည် ယခုလက်ရှိ မရရှိနိုင်ပါ။ မကြာမီ ပြန်လည်ရရှိနိုင်ပါမည်။"
          : "This item is currently unavailable. Please check back later or browse our other items."}
      </p>

      {/* Back button */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {isBurmese ? "မီနူးသို့ပြန်သွားရန်" : "Back to Menu"}
      </Link>
    </div>
  );
}
