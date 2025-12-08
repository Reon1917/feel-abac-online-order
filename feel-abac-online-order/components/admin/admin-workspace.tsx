"use client";

import { useRouter } from "next/navigation";
import { AdminList } from "./admin-list";
import { AdminManagement } from "./admin-management";
import { Button } from "@/components/ui/button";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function AdminWorkspace({
  adminList,
  currentUserId,
  isSuperAdmin,
  locale,
}: AdminWorkspaceProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(withLocalePath(locale, path));
  };

  const handleScrollToAdmin = () => {
    const section = document.getElementById("admin-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Admin workspace
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Pick a module to manage
          </h2>
          <p className="text-sm text-slate-600">
            Each card jumps straight into a focused area of the dashboard.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Menu
              </p>
              <h3 className="text-base font-semibold text-slate-900">
                Menu tools
              </h3>
              <p className="text-sm text-slate-600">
                Edit categories and dishes, tweak layout, and configure set menu pools.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleNavigate("/admin/menu")}
              >
                Menu builder
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    More menu tools
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleNavigate("/admin/menu/layout");
                    }}
                  >
                    Menu layout editor
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleNavigate("/admin/menu/pools");
                    }}
                  >
                    Set menu choice pools
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleNavigate("/admin/menu/recommended");
                    }}
                  >
                    Featured items
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Admins
              </p>
              <h3 className="text-base font-semibold text-slate-900">
                Admin access
              </h3>
              <p className="text-sm text-slate-600">
                Add or remove admin users with guardrails for super admins.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-slate-200 text-slate-800 hover:bg-slate-50"
              onClick={handleScrollToAdmin}
            >
              Manage admins
            </Button>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Delivery
              </p>
              <h3 className="text-base font-semibold text-slate-900">
                Delivery locations
              </h3>
              <p className="text-sm text-slate-600">
                Keep the AU condo list up to date so diners can pick their building quickly.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleNavigate("/admin/delivery")}
            >
              Edit delivery locations
            </Button>
          </div>
        </div>
      </section>

      <div
        id="admin-section"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-5 lg:grid-cols-2">
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
