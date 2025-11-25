import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function AdminDashboard({ params }: PageProps) {
  const { lang } = await params;
  
  // Validate locale and redirect to default if invalid
  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(DEFAULT_LOCALE, "/admin/dashboard"));
  }
  
  const locale = lang as Locale;
  const dict = getDictionary(locale, "adminDashboard");
  const common = getDictionary(locale, "common");

  const sessionData = await getSession();

  if (!sessionData?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  // Get current admin info
  const currentAdmin = await getAdminByUserId(sessionData.session.user.id);
  const isSuperAdmin = currentAdmin?.role === "super_admin";

  // Fetch admin list
  const adminList = await db
    .select({
      id: admins.id,
      userId: admins.userId,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      isActive: admins.isActive,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.createdAt);

  return (
    <>
      <nav className="flex items-center justify-end bg-white px-6 py-4 text-slate-900 sm:px-10 lg:px-12">
        <Suspense fallback={<div className="w-40" />}>
          <UiLanguageSwitcher
            locale={locale}
            labels={common.languageSwitcher}
          />
        </Suspense>
      </nav>
      <div className="admin-light-surface min-h-screen bg-white px-6 py-10 text-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.workspace.badge}
              </span>
              <h1 className="text-3xl font-semibold">{dict.header.title}</h1>
              <p className="text-sm text-slate-600">{dict.header.subtitle}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline">
                <Link href={withLocalePath(locale, "/menu")}>View customer side</Link>
              </Button>
              <SignOutButton variant="ghost" />
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Orders
                </p>
                <p className="text-sm text-slate-600">
                  Jump to order management and live updates.
                </p>
              </div>
              <Button asChild>
                <Link href={withLocalePath(locale, "/admin/orders")}>
                  Go to orders
                </Link>
              </Button>
            </div>
          </section>

          <AdminWorkspace
            adminList={adminList}
            currentUserId={sessionData.session.user.id}
            isSuperAdmin={isSuperAdmin ?? false}
            locale={locale}
          />
        </div>
      </div>
    </>
  );
}
