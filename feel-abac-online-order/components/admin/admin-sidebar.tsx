"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Bell,
  UtensilsCrossed,
  MapPin,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Store,
  Package,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { AdminRole } from "@/lib/admin/types";
import { isRoleAtLeast } from "@/lib/admin/permissions";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  // Required minimum role to see this item
  minRole?: AdminRole;
};

type NavSection = {
  title: string;
  items: NavItem[];
  // Required minimum role to see this section
  minRole?: AdminRole;
};

type AdminSidebarProps = {
  locale: Locale;
  currentUser: {
    name: string;
    email: string;
  };
  liveOrderCount?: number;
  adminRole: AdminRole;
};

// Helper to check if user has minimum required role (handles optional requirement)
function meetsRoleRequirement(userRole: AdminRole, requiredRole?: AdminRole): boolean {
  if (!requiredRole) return true;
  return isRoleAtLeast(userRole, requiredRole);
}

export function AdminSidebar({
  locale,
  currentUser,
  liveOrderCount,
  adminRole,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navSections: NavSection[] = useMemo(
    () => [
      {
        title: "CORE",
        items: [
          {
            href: "/admin/dashboard",
            icon: LayoutDashboard,
            label: "Dashboard",
          },
          {
            href: "/admin/orders",
            icon: Bell,
            label: "Live Orders",
            badge: liveOrderCount,
          },
        ],
      },
      {
        title: "OPERATIONS",
        items: [
          {
            href: "/admin/settings/shop",
            icon: Store,
            label: "Shop Status",
          },
          {
            href: "/admin/stock",
            icon: Package,
            label: "Stock Control",
          },
        ],
      },
      {
        title: "MANAGEMENT",
        minRole: "admin",
        items: [
          {
            href: "/admin/menu",
            icon: UtensilsCrossed,
            label: "Menu Tools",
            minRole: "admin",
          },
          {
            href: "/admin/delivery",
            icon: MapPin,
            label: "Delivery Locations",
            minRole: "admin",
          },
        ],
      },
      {
        title: "SETTINGS",
        minRole: "admin",
        items: [
          {
            href: "/admin/settings/team",
            icon: Users,
            label: "Team Access",
            minRole: "super_admin",
          },
          {
            href: "/admin/settings/promptpay",
            icon: CreditCard,
            label: "Payments",
            minRole: "admin",
          },
        ],
      },
    ],
    [liveOrderCount]
  );

  // Filter sections and items based on role
  const filteredSections = useMemo(() => {
    return navSections
      .filter((section) => meetsRoleRequirement(adminRole, section.minRole))
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          meetsRoleRequirement(adminRole, item.minRole)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, adminRole]);

  const isActive = (href: string) => {
    const fullPath = withLocalePath(locale, href);
    return pathname === fullPath || pathname.startsWith(fullPath + "/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: AdminRole) => {
    switch (role) {
      case "super_admin":
        return { label: "Super Admin", color: "bg-purple-100 text-purple-700" };
      case "admin":
        return { label: "Admin", color: "bg-emerald-100 text-emerald-700" };
      case "moderator":
        return { label: "Moderator", color: "bg-blue-100 text-blue-700" };
      default:
        return { label: "Unknown", color: "bg-slate-100 text-slate-700" };
    }
  };

  const roleBadge = getRoleBadge(adminRole);

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo Header */}
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <Link
          href={withLocalePath(locale, "/admin/dashboard")}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Store className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold text-slate-900">AdminPanel</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {filteredSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={withLocalePath(locale, item.href)}
                    className={clsx(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon
                      className={clsx(
                        "h-5 w-5 shrink-0",
                        active
                          ? "text-emerald-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-semibold text-white">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute left-12 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[0.6rem] font-bold text-white">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-600"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* User Section */}
      <div className="border-t border-slate-200 p-3">
        <div
          className={clsx(
            "flex items-center gap-3 rounded-lg p-2",
            isCollapsed && "justify-center"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            {getInitials(currentUser.name)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-slate-900">
                {currentUser.name}
              </p>
              <p
                className={clsx(
                  "inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-medium",
                  roleBadge.color
                )}
              >
                {roleBadge.label}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <SignOutButton
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              ariaLabel="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </SignOutButton>
          )}
        </div>
      </div>
    </aside>
  );
}
