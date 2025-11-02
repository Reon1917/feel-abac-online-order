import { unstable_noStore as noStore } from "next/cache";
import { AdminMenuManager } from "@/components/admin/menu/menu-manager";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { getAdminMenuHierarchy } from "@/lib/menu/queries";

export default async function AdminMenuPage() {
  noStore();

  await requireActiveAdmin();

  const menu = await getAdminMenuHierarchy();

  return (
    <main className="admin-light-surface min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Menu builder
            </span>
            <h1 className="text-3xl font-semibold text-slate-900">
              Craft your digital lineup
            </h1>
            <p className="text-sm text-slate-600">
              Categories cascade into menu items, choice groups, and options. Items and images cache
              aggressively, so updates generate fresh URLs automatically.
            </p>
          </div>
        </header>

        <AdminMenuManager initialMenu={menu} />
      </div>
    </main>
  );
}
