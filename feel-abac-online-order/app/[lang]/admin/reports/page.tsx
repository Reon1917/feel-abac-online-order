import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

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
    from?: string;
    to?: string;
  }>;
};

type ReportPeriodKey =
  | "today"
  | "yesterday"
  | "last3"
  | "last7";

type PeriodOption = {
  key: ReportPeriodKey;
  range: AdminReportRange;
  label: string;
  description: string;
};

type CustomRange = {
  fromDay: string;
  toDay: string;
};

const PERIOD_TO_RANGE: Record<ReportPeriodKey, AdminReportRange> = {
  today: "today",
  yesterday: "yesterday",
  last3: "last_3_days",
  last7: "last_7_days",
};

const PERIOD_KEYS = Object.keys(PERIOD_TO_RANGE) as ReportPeriodKey[];

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function toIsoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDayToUtc(day: string): Date {
  const [yearRaw, monthRaw, dayRaw] = day.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, date));
}

function isValidIsoDay(day: string | undefined): day is string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }
  const parsed = parseIsoDayToUtc(day);
  return Number.isFinite(parsed.getTime()) && toIsoDayUtc(parsed) === day;
}

function shiftIsoDay(day: string, days: number) {
  const next = parseIsoDayToUtc(day);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDayUtc(next);
}

function getBangkokTodayIsoDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function clampIsoDay(day: string, minDay: string, maxDay: string) {
  if (day < minDay) return minDay;
  if (day > maxDay) return maxDay;
  return day;
}

function resolvePeriodKey(period: string | undefined): ReportPeriodKey {
  if (period === "yesterday") return "yesterday";
  if (period === "last3") return "last3";
  if (period === "last7") return "last7";
  return "today";
}

function resolvePeriodRange(periodKey: ReportPeriodKey): AdminReportRange {
  return PERIOD_TO_RANGE[periodKey];
}

function resolveQuickBounds(periodKey: ReportPeriodKey, todayDay: string): CustomRange {
  if (periodKey === "today") {
    return { fromDay: todayDay, toDay: todayDay };
  }
  if (periodKey === "yesterday") {
    const yesterday = shiftIsoDay(todayDay, -1);
    return { fromDay: yesterday, toDay: yesterday };
  }
  if (periodKey === "last3") {
    return { fromDay: shiftIsoDay(todayDay, -2), toDay: todayDay };
  }
  return { fromDay: shiftIsoDay(todayDay, -6), toDay: todayDay };
}

function rangesEqual(a: CustomRange, b: CustomRange) {
  return a.fromDay === b.fromDay && a.toDay === b.toDay;
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
  const todayDay = getBangkokTodayIsoDay();
  const minSelectableDay = shiftIsoDay(todayDay, -6);
  const selectedPeriodKey = resolvePeriodKey(
    typeof query.period === "string" ? query.period : undefined
  );
  const selectedRange = resolvePeriodRange(selectedPeriodKey);

  const rawFrom = typeof query.from === "string" ? query.from : undefined;
  const rawTo = typeof query.to === "string" ? query.to : undefined;
  const parsedFrom = isValidIsoDay(rawFrom) ? rawFrom : null;
  const parsedTo = isValidIsoDay(rawTo) ? rawTo : null;

  const selectedCustomRange: CustomRange | null = (() => {
    if (!parsedFrom || !parsedTo) return null;
    let fromDay = parsedFrom;
    let toDay = parsedTo;
    if (fromDay > toDay) {
      [fromDay, toDay] = [toDay, fromDay];
    }
    fromDay = clampIsoDay(fromDay, minSelectableDay, todayDay);
    toDay = clampIsoDay(toDay, minSelectableDay, todayDay);
    if (fromDay > toDay) {
      fromDay = toDay;
    }
    return { fromDay, toDay };
  })();

  const quickBounds = resolveQuickBounds(selectedPeriodKey, todayDay);
  const fromInputValue = selectedCustomRange?.fromDay ?? quickBounds.fromDay;
  const toInputValue = selectedCustomRange?.toDay ?? quickBounds.toDay;

  const periodOptions: PeriodOption[] = PERIOD_KEYS.map((key) => ({
    key,
    range: PERIOD_TO_RANGE[key],
    label: dictionary.periods[key],
    description: dictionary.periodDescriptions[key],
  }));
  const selectedOption =
    periodOptions.find((option) => option.key === selectedPeriodKey) ??
    periodOptions[0];
  const activeQuickKey: ReportPeriodKey | null = selectedCustomRange
    ? (periodOptions.find((option) =>
        rangesEqual(selectedCustomRange, resolveQuickBounds(option.key, todayDay))
      )?.key ?? null)
    : selectedPeriodKey;
  const isCustomOnly = selectedCustomRange != null && activeQuickKey == null;
  const selectedSummary = selectedCustomRange
    ? `${formatDisplayDay(selectedCustomRange.fromDay, locale)} - ${formatDisplayDay(
        selectedCustomRange.toDay,
        locale
      )}`
    : selectedOption.description;

  const orders = await getOrdersForAdminReport({
    range: selectedRange,
    fromDay: selectedCustomRange?.fromDay,
    toDay: selectedCustomRange?.toDay,
  });
  const analytics = buildAdminSalesAnalytics(orders);

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title={dictionary.pageTitle}
        subtitle={dictionary.pageSubtitle}
        languageLabels={common.languageSwitcher}
      />

      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-4 flex justify-end">
          <div className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-md sm:max-w-[760px]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.quickRangeLabel}
              </p>
              <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
                <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
                {periodOptions.map((option) => {
                  const active = activeQuickKey === option.key;
                  return (
                    <Button
                      key={option.key}
                      asChild
                      variant="ghost"
                      size="sm"
                      className={
                        active
                          ? "h-8 rounded-md whitespace-nowrap border border-emerald-300 bg-emerald-100 text-emerald-900 shadow-md hover:bg-emerald-100"
                          : "h-8 rounded-md whitespace-nowrap text-slate-600 hover:bg-white/80 hover:text-slate-900"
                      }
                    >
                      <Link
                        href={withLocalePath(
                          locale,
                          `/admin/reports?period=${option.key}`
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {option.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>

            <form
              method="get"
              action={withLocalePath(locale, "/admin/reports")}
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
            >
              <div className="min-w-0">
                <label
                  htmlFor="reports-from-day"
                  className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {dictionary.fromLabel}
                </label>
                <input
                  id="reports-from-day"
                  name="from"
                  type="date"
                  defaultValue={fromInputValue}
                  min={minSelectableDay}
                  max={todayDay}
                  className={
                    isCustomOnly
                      ? "mt-1 h-9 w-full rounded-md border border-emerald-300 bg-emerald-50 px-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      : "mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  }
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="reports-to-day"
                  className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {dictionary.toLabel}
                </label>
                <input
                  id="reports-to-day"
                  name="to"
                  type="date"
                  defaultValue={toInputValue}
                  min={minSelectableDay}
                  max={todayDay}
                  className={
                    isCustomOnly
                      ? "mt-1 h-9 w-full rounded-md border border-emerald-300 bg-emerald-50 px-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      : "mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  }
                />
              </div>

              <Button type="submit" size="sm" className="mt-5">
                {dictionary.applyRange}
              </Button>

              <Button asChild variant="outline" size="sm" className="mt-5">
                <Link href={withLocalePath(locale, "/admin/reports?period=today")}>
                  {dictionary.resetRange}
                </Link>
              </Button>
            </form>

            <p className={isCustomOnly ? "mt-2 text-xs text-emerald-700" : "mt-2 text-xs text-slate-500"}>
              {selectedSummary}
              {" · "}
              {dictionary.customRangeHint}
            </p>
          </div>
        </div>

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
