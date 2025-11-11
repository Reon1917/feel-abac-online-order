"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminList } from "./admin-list";
import { AdminManagement } from "./admin-management";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
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
    title: "Menu drops",
    description: "Plan rotations, attach prep notes, and preview customer view.",
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

  const currentPanel = panels.find((panel) => panel.id === activePanel);

  const handleNavigate = (path: string) => {
    router.push(withLocalePath(locale, path));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3">
        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => {
              setActivePanel(panel.id);
            }}
            className={clsx(
              "flex h-full flex-col justify-between gap-4 rounded-lg border p-5 text-left transition",
              activePanel === panel.id
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
            )}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {panel.id === "team" ? "Admins" : panel.id === "menu" ? "Menu" : "Operations"}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">{panel.title}</h2>
              <p className="text-sm text-slate-600">{panel.description}</p>
            </div>
            <span className="text-sm font-semibold text-emerald-700">Open workspace →</span>
          </button>
        ))}
      </section>

      {activePanel && currentPanel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {currentPanel.id === "team" ? "Admin guardrails" : currentPanel.id === "menu" ? "Menu planning" : "Fulfilment"}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">{currentPanel.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{currentPanel.description}</p>
            </div>
            <Button variant="ghost" onClick={() => setActivePanel(null)}>
              Close panel
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            {activePanel === "team" ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <AdminManagement isSuperAdmin={isSuperAdmin} />
                <AdminList
                  initialAdmins={adminList}
                  currentUserId={currentUserId}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            ) : activePanel === "menu" ? (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <p className="text-base font-semibold text-slate-900">
                  Menu builder
                </p>
                <p>
                  We built a dedicated full-screen experience for managing menu categories, items, images,
                  and choice groups. Launch it with the button below.
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="inline-flex items-center gap-1">
                      Menu tools
                      <ChevronDownIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[12rem]">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        handleNavigate("/admin/menu");
                      }}
                    >
                      Builder studio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        handleNavigate("/admin/menu/layout");
                      }}
                    >
                      Layout editor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <p className="text-base font-semibold text-slate-900">Orders control (mock)</p>
                <p>
                  Visualize ticket load, pause intake when stations hit thresholds, and send quick pickup
                  updates to customers.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Live timers for each order stage.</li>
                  <li>Auto-throttle presets for peak hours.</li>
                  <li>Escalation feed for delayed dishes.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
