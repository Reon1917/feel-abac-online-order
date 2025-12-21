import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { ArchivedOrdersClient } from "@/components/admin/orders/archived-orders-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getArchivedOrderDays, getArchivedOrdersForAdminFiltered } from "@/lib/orders/queries";
import type { OrderStatus } from "@/lib/orders/types";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{
    day?: string;
    status?: string;
    refund?: string;
    q?: string;
    min?: string;
    max?: string;
  }>;
};

export default async function ArchivedOrdersPage({
  params,
  searchParams,
}: PageProps) {
  noStore();
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const locale = lang as Locale;

  const dictionary = getDictionary(locale, "adminOrders");
  const common = getDictionary(locale, "common");
  const days = await getArchivedOrderDays();
  const requestedDay = typeof query.day === "string" ? query.day.trim() : "";
  const dayValue =
    requestedDay && requestedDay !== "all" && days.includes(requestedDay)
      ? requestedDay
      : null;

  const allowedStatuses: OrderStatus[] = [
    "order_processing",
    "awaiting_payment",
    "payment_review",
    "order_in_kitchen",
    "order_out_for_delivery",
    "delivered",
    "closed",
    "cancelled",
  ];
  const statusValue =
    typeof query.status === "string" && allowedStatuses.includes(query.status as OrderStatus)
      ? (query.status as OrderStatus)
      : null;
  const refundValue =
    typeof query.refund === "string" &&
    ["requested", "paid", "none"].includes(query.refund)
      ? (query.refund as "requested" | "paid" | "none")
      : null;
  const searchValue =
    typeof query.q === "string" && query.q.trim().length > 0
      ? query.q.trim()
      : null;
  const minValue =
    typeof query.min === "string" && query.min.trim().length > 0
      ? Number(query.min)
      : null;
  const maxValue =
    typeof query.max === "string" && query.max.trim().length > 0
      ? Number(query.max)
      : null;

  const normalizedMin =
    typeof minValue === "number" && Number.isFinite(minValue) && minValue >= 0
      ? minValue
      : null;
  const normalizedMax =
    typeof maxValue === "number" && Number.isFinite(maxValue) && maxValue >= 0
      ? maxValue
      : null;

  const finalMin =
    normalizedMin !== null && normalizedMax !== null && normalizedMax < normalizedMin
      ? normalizedMax
      : normalizedMin;
  const finalMax =
    normalizedMin !== null && normalizedMax !== null && normalizedMax < normalizedMin
      ? normalizedMin
      : normalizedMax;

  const orders = await getArchivedOrdersForAdminFiltered({
    displayDay: dayValue,
    status: statusValue,
    refundStatus: refundValue,
    query: searchValue,
    minTotal: finalMin,
    maxTotal: finalMax,
  });

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.archivedPageTitle ?? "Past Orders"}
        subtitle={dictionary.archivedListTitle ?? "Orders from previous days"}
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            <MenuLanguageToggle
              labels={{
                label: dictionary.menuLanguageLabel ?? "Menu language",
                english: dictionary.menuLanguageEnglish ?? "English names",
                burmese: dictionary.menuLanguageBurmese ?? "Burmese names",
              }}
              hideLabel
            />
            <Button asChild variant="outline" size="sm">
              <Link href={withLocalePath(locale, "/admin/orders")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dictionary.backToToday ?? "Back to Today"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <ArchivedOrdersClient
          initialOrders={orders}
          dictionary={dictionary}
          days={days}
          initialFilters={{
            day: dayValue ?? "all",
            status: statusValue ?? "all",
            refund: refundValue ?? "all",
            query: searchValue ?? "",
            min: finalMin !== null ? String(finalMin) : "",
            max: finalMax !== null ? String(finalMax) : "",
          }}
        />
      </div>
    </AdminLayoutShell>
  );
}
