import { unstable_noStore as noStore } from "next/cache";
import { AdminMenuManager } from "@/components/admin/menu/menu-manager";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";

export default async function AdminMenuPage() {
  noStore();

  await requireActiveAdmin();

  const menu = await getAdminMenuHierarchy();
  const totalCategories = menu.length;
  const hiddenCategories = menu.filter((category) => !category.isActive).length;
  const totalItems = menu.reduce((sum, category) => sum + category.items.length, 0);
  const publishedItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status === "published").length,
    0
  );
  const draftItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => item.status !== "published").length,
    0
  );
  const unavailableItems = menu.reduce(
    (sum, category) =>
      sum + category.items.filter((item) => !item.isAvailable).length,
    0
  );

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  const stats = [
    {
      label: "Categories",
      value: totalCategories,
      detail:
        hiddenCategories === 0
          ? "All visible to diners"
          : `${formatNumber(hiddenCategories)} hidden from diners`,
    },
    {
      label: "Menu items",
      value: totalItems,
      detail:
        unavailableItems === 0
          ? "All marked available"
          : `${formatNumber(unavailableItems)} unavailable right now`,
    },
    {
      label: "Published",
      value: publishedItems,
      detail: publishedItems === 0 ? "Nothing live yet" : "Live for diners",
    },
    {
      label: "Drafts",
      value: draftItems,
      detail:
        draftItems === 0
          ? "Nothing pending"
          : `${formatNumber(draftItems)} awaiting review`,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-linear-to-r from-white via-emerald-50 to-white">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-6 py-12 lg:px-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Menu workspace
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Craft your digital lineup
              </h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Keep categories, dishes, choice groups, and pricing aligned. Review progress at a glance and publish updates when everything looks perfect.
              </p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Publish checklist
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>Confirm Burmese names so diners see localized copy.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>Hide categories until they’re ready with the visibility toggle.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>Save new dishes as drafts while pricing or notes are still in progress.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>Use refresh after bulk edits to pull the latest menu tree.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatNumber(stat.value)}
                </p>
                <p className="text-xs text-slate-500">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

  <section className="mx-auto -mt-8 w-full max-w-[1360px] px-6 pb-16 lg:px-12">
        <AdminMenuManager initialMenu={menu} variant="workspace" />
      </section>
    </main>
  );
}
