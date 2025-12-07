"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminList } from "./admin-list";
import { AdminManagement } from "./admin-management";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type AdminRecord = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

type AdminWorkspaceProps = {
  adminList: AdminRecord[];
  currentUserId: string;
  isSuperAdmin: boolean;
  locale: Locale;
};

const panels = [
  {
    id: "orders",
    title: "Live orders",
    description: "Track prep stages and throttle slots when the queue spikes.",
  },
  {
    id: "menu",
    title: "Menu & set menus",
    description: "Manage categories, dishes, layout, and set-menu pools in one place.",
  },
  {
    id: "team",
    title: "Team access",
    description: "Promote or retire admins with safe-guarded workflows.",
  },
];

export function AdminWorkspace({
  adminList,
  currentUserId,
  isSuperAdmin,
  locale,
}: AdminWorkspaceProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const handleNavigate = (path: string) => {
    router.push(withLocalePath(locale, path));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3">
        {panels.map((panel) => {
          const href =
            panel.id === "orders"
              ? "/admin/orders"
              : panel.id === "menu"
                ? "/admin/menu"
                : "/admin/settings/admins";

          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => handleNavigate(href)}
              className={clsx(
                "flex h-full flex-col justify-between gap-4 rounded-lg border p-5 text-left transition",
                "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
              )}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {panel.id === "team"
                    ? "Admins"
                    : panel.id === "menu"
                      ? "Menu"
                      : "Operations"}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {panel.title}
                </h2>
                <p className="text-sm text-slate-600">{panel.description}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-700">
                Go to {panel.id === "team" ? "team" : panel.id} →
              </span>
            </button>
          );
        })}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Delivery coverage
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Add Delivery Locations</h2>
          <p className="text-sm text-slate-600">
            Keep the AU condo list accurate so diners can pick their spot quickly.
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => handleNavigate("/admin/delivery")}
        >
          Add Delivery Locations
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Builder studio
              </p>
              <h2 className="text-base font-semibold text-slate-900">
                Menu builder
              </h2>
              <p className="text-sm text-slate-600">
                Manage categories, items, and choice groups in the full builder workspace.
              </p>
            </div>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => handleNavigate("/admin/menu")}
            >
              Open menu builder
            </Button>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Set menu pools
              </p>
              <h2 className="text-base font-semibold text-slate-900">
                Choice pools & options
              </h2>
              <p className="text-sm text-slate-600">
                Configure reusable pools for set menus, then attach them in the menu builder.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-4 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              size="sm"
              onClick={() => handleNavigate("/admin/menu/pools")}
            >
              Manage choice pools
            </Button>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Recommendations & layout
              </p>
              <h2 className="text-base font-semibold text-slate-900">
                Layout & featured items
              </h2>
              <p className="text-sm text-slate-600">
                Reorder sections, adjust layout, and pin must-try items for diners.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleNavigate("/admin/menu/layout")}
              >
                Layout editor
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleNavigate("/admin/menu/recommended")}
              >
                Featured items
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Team access
            </p>
            <p className="text-base font-semibold text-slate-900">
              Admin guardrails & access
            </p>
            <p className="text-sm text-slate-600">
              Promote or retire admins with safe-guarded workflows. Only super admins can manage roles.
            </p>
            <div className="mt-4">
              <AdminManagement isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Admin directory
            </p>
            <p className="text-base font-semibold text-slate-900">
              Current admin list
            </p>
            <p className="text-sm text-slate-600">
              See who has access to the dashboard and quickly pause or remove accounts.
            </p>
            <div className="mt-4">
              <AdminList
                initialAdmins={adminList}
                currentUserId={currentUserId}
                isSuperAdmin={isSuperAdmin}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
