import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { getDeliveryLocationsForAdmin } from "@/lib/delivery/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { DeliveryLocationForm } from "@/components/admin/delivery/location-form";
import { DeliveryLocationEditDialog } from "@/components/admin/delivery/location-edit-dialog";
import { DeleteLocationButton } from "@/components/admin/delivery/delete-location-button";

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

  const dict = getDictionary(locale, "adminDelivery");
  const common = getDictionary(locale, "common");
  const locations = await getDeliveryLocationsForAdmin();
  const activeLocations = locations.filter((location) => location.isActive);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dict.header.title}
        subtitle={dict.header.subtitle}
        languageLabels={common.languageSwitcher}
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={3}>
          <StatsCard
            title={
              dict.stats?.activePresetLocations?.title ??
              "Active Preset Locations"
            }
            value={activeLocations.length}
            subtitle={
              dict.stats?.activePresetLocations?.subtitle ??
              "Preset choices available to customers"
            }
            variant="success"
          />
          <StatsCard
            title={
              dict.stats?.totalPresetLocations?.title ??
              "Total Preset Locations"
            }
            value={locations.length}
            subtitle={
              dict.stats?.totalPresetLocations?.subtitle ??
              "All preset choices configured"
            }
          />
          <StatsCard
            title={dict.stats?.buildingOptions?.title ?? "Building Options"}
            value={activeLocations.reduce(
              (sum, loc) => sum + loc.buildings.length,
              0
            )}
            subtitle={
              dict.stats?.buildingOptions?.subtitle ??
              "Total selectable building entries"
            }
          />
        </StatsGrid>

        <div className="mt-4 grid gap-4 md:mt-6 md:gap-6 lg:grid-cols-[1fr_2fr]">
          <DeliveryLocationForm dictionary={dict.form} />
          
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
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
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <DeliveryLocationEditDialog
                          location={location}
                          dictionary={dict}
                        />
                        <DeleteLocationButton
                          locationId={location.id}
                          dictionary={dict}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminLayoutShell>
  );
}
