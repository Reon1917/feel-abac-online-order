import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, UtensilsCrossed, MapPin, Users, CreditCard, Store, Package, BarChart3 } from "lucide-react";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getActivePromptPayAccount } from "@/lib/payments/queries";
import { formatPromptPayPhoneForDisplay } from "@/lib/payments/promptpay";
import { getTodayOrdersForAdmin } from "@/lib/orders/queries";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import type { AdminRole } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminDashboard({ params }: PageProps) {
  const { lang } = await params;

  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(DEFAULT_LOCALE, "/admin/dashboard"));
  }

  const locale = lang as Locale;
  const common = getDictionary(locale, "common");
  const dashboardDictionary = getDictionary(locale, "adminDashboard");

  const sessionData = await getSession();

  if (!sessionData?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const userId = sessionData.session?.user?.id;
  const currentAdmin = userId ? await getAdminByUserId(userId) : null;
  const adminRole = (currentAdmin?.role ?? "moderator") as AdminRole;

  // Role hierarchy check
  const ROLE_HIERARCHY: AdminRole[] = ["moderator", "admin", "super_admin"];
  const hasMinRole = (required?: AdminRole) => {
    if (!required) return true;
    return ROLE_HIERARCHY.indexOf(adminRole) >= ROLE_HIERARCHY.indexOf(required);
  };

  const activePromptPay = await getActivePromptPayAccount();
  const orders = await getTodayOrdersForAdmin();

  // Calculate stats
  const adminCount = await db.select({ id: admins.id }).from(admins);
  const liveOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  ).length;
  const completedToday = orders.filter((o) => o.status === "delivered").length;

  // Quick action cards data - filtered by role
  const allQuickActions = [
    {
      icon: Bell,
      label: "Live Orders",
      description: "Monitor incoming orders and update statuses in real-time.",
      href: "/admin/orders",
      badge: liveOrders > 0 ? liveOrders : undefined,
      variant: "primary" as const,
    },
    {
      icon: Store,
      label: "Shop Status",
      description: "Open or close the shop for accepting orders.",
      href: "/admin/settings/shop",
      variant: "default" as const,
    },
    {
      icon: BarChart3,
      label: "Reports",
      description: "Track sales, tax, delivery, and refund-aware analytics.",
      href: "/admin/reports",
      variant: "default" as const,
    },
    {
      icon: Package,
      label: "Availability",
      description: "Mark items as available or unavailable.",
      href: "/admin/stock",
      variant: "default" as const,
    },
    {
      icon: UtensilsCrossed,
      label: "Menu Tools",
      description: "Edit categories, dishes, layout, and set menu configurations.",
      href: "/admin/menu",
      variant: "default" as const,
      minRole: "admin" as AdminRole,
    },
    {
      icon: MapPin,
      label:
        dashboardDictionary.quickActions?.presetLocations?.label ??
        "Preset Locations",
      description:
        dashboardDictionary.quickActions?.presetLocations?.description ??
        "Manage saved preset locations customers can choose during checkout.",
      href: "/admin/delivery",
      variant: "default" as const,
      minRole: "admin" as AdminRole,
    },
    {
      icon: Users,
      label: "Team Access",
      description: "Add or remove admin users and manage permissions.",
      href: "/admin/settings/team",
      variant: "default" as const,
      minRole: "super_admin" as AdminRole,
    },
    {
      icon: CreditCard,
      label: "Payment Settings",
      description: activePromptPay
        ? `Active: ${activePromptPay.name} · ${formatPromptPayPhoneForDisplay(activePromptPay.phoneNumber)}`
        : "Configure PromptPay accounts for receiving payments.",
      href: "/admin/settings/promptpay",
      variant: "default" as const,
      minRole: "admin" as AdminRole,
    },
  ];

  const quickActions = allQuickActions.filter((action) => hasMinRole(action.minRole));

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title="Dashboard"
        subtitle="Welcome back! Here's an overview of your restaurant."
        languageLabels={common.languageSwitcher}
      />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8">
        {/* Stats Overview */}
        <StatsGrid columns={4}>
          <StatsCard label="Live Orders" value={liveOrders} variant="success" />
          <StatsCard label="Completed Today" value={completedToday} />
          <StatsCard label="Total Orders Today" value={orders.length} />
          <StatsCard label="Team Members" value={adminCount.length} />
        </StatsGrid>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Quick Actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={withLocalePath(locale, action.href)}
                  className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    {action.badge && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-bold text-white">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900">{action.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity or Tips */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            Getting Started
          </h2>
          <p className="text-sm text-slate-500">
            Use the sidebar to navigate between different sections of the admin panel. 
            The Live Orders section will show real-time updates when customers place orders.
          </p>
        </div>
      </div>
    </AdminLayoutShell>
  );
}
