import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getDeliveryLocationsForAdmin } from "@/lib/delivery/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { DeliveryLocationForm } from "@/components/admin/delivery/location-form";
import { DeliveryLocationEditDialog } from "@/components/admin/delivery/location-edit-dialog";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminDeliveryPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = SUPPORTED_LOCALES.includes(lang as Locale)
    ? (lang as Locale)
    : DEFAULT_LOCALE;

  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(locale, "/admin/delivery"));
  }

  const session = await requireActiveAdmin();
  if (!session) {
    redirect(withLocalePath(locale, "/"));
  }

  const dict = getDictionary(locale, "adminDelivery");
  const common = getDictionary(locale, "common");
  const locations = await getDeliveryLocationsForAdmin();
  const activeLocations = locations.filter((location) => location.isActive);

  return (
    <>
      <nav className="flex items-center justify-end bg-white px-6 py-4 text-slate-900 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
        </Suspense>
      </nav>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="border-b border-slate-200 bg-white/80">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10 lg:px-10">
            <Link
              href={withLocalePath(locale, "/admin/dashboard")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
            >
              <ArrowLeft className="size-4" />
              {dict.header.backToDashboard}
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              {dict.header.badge}
            </span>
            <h1 className="text-3xl font-semibold">{dict.header.title}</h1>
            <p className="text-sm text-slate-600">{dict.header.subtitle}</p>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-16 pt-8 lg:grid-cols-[2fr_3fr] lg:px-10">
          <DeliveryLocationForm dictionary={dict.form} />
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                {dict.list.title}
              </h3>
              <p className="text-sm text-slate-600">{dict.list.subtitle}</p>
            </div>
            {activeLocations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                {dict.list.empty}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeLocations.map((location) => (
                  <li
                    key={location.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {location.condoName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <p className="text-xs font-semibold text-slate-500">
                        {dict.list.columns.fee}
                      </p>
                      <p className="text-sm text-slate-900">
                        ฿{location.minFee}–{location.maxFee}
                      </p>
                      {location.buildings.length ? (
                        <p className="text-[11px] text-slate-500">
                          {dict.list.columns.buildings}:{" "}
                          {location.buildings.map((building) => building.label).join(", ")}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          {dict.list.columns.buildings}: –
                        </p>
                      )}
                      <DeliveryLocationEditDialog
                        location={location}
                        dictionary={dict}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
