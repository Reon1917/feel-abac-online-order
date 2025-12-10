import { redirect } from "next/navigation";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatsCard, StatsGrid } from "@/components/admin/stats-card";
import { TeamAccessClient } from "./team-access-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function TeamAccessPage({ params }: PageProps) {
  const { lang } = await params;

  if (!SUPPORTED_LOCALES.includes(lang as Locale)) {
    redirect(withLocalePath(DEFAULT_LOCALE, "/admin/settings/team"));
  }

  const locale = lang as Locale;
  const common = getDictionary(locale, "common");

  const sessionData = await getSession();

  if (!sessionData?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

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

  // Calculate stats
  const totalAdmins = adminList.length;
  const superAdmins = adminList.filter((a) => a.role === "super_admin").length;
  const pendingInvites = 0; // Placeholder for future invite system

  return (
    <AdminLayoutShell locale={locale}>
      <AdminHeader
        locale={locale}
        title="Team Access"
        subtitle="Manage admins, assign roles, and control dashboard access."
        languageLabels={common.languageSwitcher}
      />

      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8">
        {/* Stats Cards */}
        <StatsGrid columns={3}>
          <StatsCard label="Total Admins" value={totalAdmins} />
          <StatsCard label="Super Admins" value={superAdmins} variant="success" />
          <StatsCard label="Pending Invites" value={pendingInvites} />
        </StatsGrid>

        {/* Admin List */}
        <div className="mt-4 md:mt-6">
          <TeamAccessClient
            initialAdmins={adminList}
            currentUserId={sessionData.session.user.id}
            isSuperAdmin={isSuperAdmin ?? false}
          />
        </div>
      </div>
    </AdminLayoutShell>
  );
}
