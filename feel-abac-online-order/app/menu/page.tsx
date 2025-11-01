import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminBar } from "@/components/admin/admin-bar";
import { ResponsiveMenuBrowser } from "@/components/menu/responsive-menu-browser";
import { PhoneEditModal } from "@/components/menu/phone-edit-modal";
import { getPublicMenuHierarchy } from "@/lib/menu/queries";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";

export default async function MenuPage() {
  noStore();

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect("/");
  }

  const profile = await getUserProfile(sessionData.session.user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  const menuCategories = await getPublicMenuHierarchy();
  const hasMenu =
    menuCategories.length > 0 &&
    menuCategories.some((category) => category.items.length > 0);

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-12">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Welcome back, {sessionData.session.user.name || "guest"} 👋
              </h1>
              <p className="flex items-center gap-1 text-sm text-slate-600">
                Reachable at{" "}
                <strong className="font-semibold text-slate-800">
                  {profile.phoneNumber}
                </strong>
                <PhoneEditModal currentPhone={profile.phoneNumber} />
              </p>
            </div>
            <SignOutButton />
          </header>

          {hasMenu ? (
            <ResponsiveMenuBrowser categories={menuCategories} />
          ) : (
            <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Menu is brewing
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Our kitchen team is composing the first lineup. Check back soon for the full spread of dishes and drinks.
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
