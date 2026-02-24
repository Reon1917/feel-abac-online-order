import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { Button } from "@/components/ui/button";
import {
  getOrdersForAdminReport,
  type AdminReportRange,
} from "@/lib/orders/queries";
import { buildAdminSalesAnalytics } from "@/lib/orders/report-analytics";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { BANGKOK_TIMEZONE } from "@/lib/timezone";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{
    period?: string;
  }>;
};

type PeriodOption = {
  key: "today" | "last7" | "last30";
  range: AdminReportRange;
};

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "today", range: "today" },
  { key: "last7", range: "last_7_days" },
  { key: "last30", range: "last_30_days" },
];

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function resolvePeriodRange(period: string | undefined): AdminReportRange {
  if (period === "last7") return "last_7_days";
  if (period === "last30") return "last_30_days";
  return "today";
}

function formatDisplayDay(displayDay: string, locale: Locale) {
  const [yearRaw, monthRaw, dayRaw] = displayDay.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return displayDay;
  }

  const value = new Date(Date.UTC(year, month - 1, day));
  const intlLocale = locale === "my" ? "my-MM" : "en-GB";
  return new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: BANGKOK_TIMEZONE,
  }).format(value);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReportsPage({
  params,
  searchParams,
}: PageProps) {
  noStore();
  const [{ lang }, query] = await Promise.all([params, searchParams]);

  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(DEFAULT_LOCALE, "/admin/reports"));
  }

  const locale = lang as Locale;
  const dictionary = getDictionary(locale, "adminReports");
  const common = getDictionary(locale, "common");
  const selectedPeriod = typeof query.period === "string" ? query.period : "today";
  const selectedRange = resolvePeriodRange(selectedPeriod);

  const orders = await getOrdersForAdminReport(selectedRange);
  const analytics = buildAdminSalesAnalytics(orders);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.pageTitle}
        subtitle={dictionary.pageSubtitle}
        languageLabels={common.languageSwitcher}
        actions={
          <div className="flex items-center gap-2">
            {PERIOD_OPTIONS.map((option) => {
              const active = selectedRange === option.range;
              return (
                <Button
                  key={option.key}
                  asChild
                  variant={active ? "default" : "outline"}
                  size="sm"
                >
                  <Link
                    href={withLocalePath(
                      locale,
                      `/admin/reports?period=${option.key}`
                    )}
                  >
                    {option.key === "today"
                      ? dictionary.periods.today
                      : option.key === "last7"
                        ? dictionary.periods.last7
                        : dictionary.periods.last30}
                  </Link>
                </Button>
              );
            })}
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <StatsGrid columns={4}>
          <StatsCard
            title={dictionary.cards.netSales}
            value={formatCurrency(analytics.netSales)}
            subtitle={dictionary.breakdown.subtitle}
            variant="success"
          />
          <StatsCard
            title={dictionary.cards.grossSales}
            value={formatCurrency(analytics.grossSales)}
            variant="info"
          />
          <StatsCard
            title={dictionary.cards.paidRefunds}
            value={formatCurrency(analytics.paidRefunds)}
            variant={analytics.paidRefunds > 0 ? "warning" : "default"}
          />
          <StatsCard
            title={dictionary.cards.pendingRefunds}
            value={formatCurrency(analytics.pendingRefunds)}
            variant={analytics.pendingRefunds > 0 ? "warning" : "default"}
          />
        </StatsGrid>

        <div className="mt-4">
          <StatsGrid columns={4}>
            <StatsCard title={dictionary.cards.orders} value={analytics.orderCount} />
            <StatsCard title={dictionary.cards.paidOrders} value={analytics.paidOrderCount} />
            <StatsCard
              title={dictionary.cards.cancelledOrders}
              value={analytics.cancelledOrderCount}
            />
            <StatsCard title={dictionary.cards.openRefunds} value={analytics.openRefundCount} />
          </StatsGrid>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">
              {dictionary.breakdown.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{dictionary.breakdown.subtitle}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>{dictionary.breakdown.food}</span>
                  <span>{formatCurrency(analytics.netBreakdown.food)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCurrency(analytics.collectedBreakdown.food)} -{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.food)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>{dictionary.breakdown.tax}</span>
                  <span>{formatCurrency(analytics.netBreakdown.tax)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCurrency(analytics.collectedBreakdown.tax)} -{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.tax)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>{dictionary.breakdown.delivery}</span>
                  <span>{formatCurrency(analytics.netBreakdown.delivery)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCurrency(analytics.collectedBreakdown.delivery)} -{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.delivery)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">
              {dictionary.refundBreakdown.title}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {dictionary.refundBreakdown.paid}
                </p>
                <p className="mt-1 text-lg font-bold text-amber-800">
                  {formatCurrency(analytics.paidRefundBreakdown.total)}
                </p>
                <p className="mt-2 text-xs text-amber-700">
                  {dictionary.breakdown.food}:{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.food)}
                </p>
                <p className="text-xs text-amber-700">
                  {dictionary.breakdown.tax}:{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.tax)}
                </p>
                <p className="text-xs text-amber-700">
                  {dictionary.breakdown.delivery}:{" "}
                  {formatCurrency(analytics.paidRefundBreakdown.delivery)}
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {dictionary.refundBreakdown.pending}
                </p>
                <p className="mt-1 text-lg font-bold text-blue-800">
                  {formatCurrency(analytics.pendingRefundBreakdown.total)}
                </p>
                <p className="mt-2 text-xs text-blue-700">
                  {dictionary.breakdown.food}:{" "}
                  {formatCurrency(analytics.pendingRefundBreakdown.food)}
                </p>
                <p className="text-xs text-blue-700">
                  {dictionary.breakdown.tax}:{" "}
                  {formatCurrency(analytics.pendingRefundBreakdown.tax)}
                </p>
                <p className="text-xs text-blue-700">
                  {dictionary.breakdown.delivery}:{" "}
                  {formatCurrency(analytics.pendingRefundBreakdown.delivery)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{dictionary.notes.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{dictionary.notes.paidOnly}</p>
              <p className="mt-1 text-xs text-slate-600">{dictionary.notes.refunds}</p>
              <p className="mt-1 text-xs text-slate-600">{dictionary.notes.allocation}</p>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {dictionary.daily.title}
          </h2>

          {analytics.byDay.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{dictionary.daily.empty}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">{dictionary.daily.columns.day}</th>
                    <th className="px-2 py-2">{dictionary.daily.columns.orders}</th>
                    <th className="px-2 py-2">{dictionary.daily.columns.paidOrders}</th>
                    <th className="px-2 py-2">{dictionary.daily.columns.gross}</th>
                    <th className="px-2 py-2">{dictionary.daily.columns.refunds}</th>
                    <th className="px-2 py-2">{dictionary.daily.columns.net}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byDay.map((row) => (
                    <tr key={row.displayDay} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-2 font-medium text-slate-700">
                        {formatDisplayDay(row.displayDay, locale)}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{row.orderCount}</td>
                      <td className="px-2 py-2 text-slate-600">{row.paidOrderCount}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {formatCurrency(row.grossSales)}
                      </td>
                      <td className="px-2 py-2 text-amber-700">
                        {formatCurrency(row.paidRefunds)}
                      </td>
                      <td className="px-2 py-2 font-semibold text-emerald-700">
                        {formatCurrency(row.netSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayoutShell>
  );
}
