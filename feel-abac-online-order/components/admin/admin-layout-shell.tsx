import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { AdminSidebar } from "./admin-sidebar";
import { AdminSidebarProvider } from "./admin-sidebar-context";
import { AdminMainContent } from "./admin-main-content";
import { getTodayOrdersForAdmin } from "@/lib/orders/queries";
import type { AdminRole } from "@/lib/admin/types";

type AdminLayoutShellProps = {
  children: React.ReactNode;
  locale: Locale;
};

export async function AdminLayoutShell({ children, locale }: AdminLayoutShellProps) {
  const sessionData = await getSession();

  if (!sessionData?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const currentAdmin = await getAdminByUserId(sessionData.session.user.id);
  
  // Get live order count for badge
  const orders = await getTodayOrdersForAdmin();
  const liveOrderCount = orders.filter(
    (o) => !["delivered", "cancelled", "closed"].includes(o.status)
  ).length;

  const currentUser = {
    name: currentAdmin?.name ?? sessionData.session.user.name ?? "Admin",
    email: currentAdmin?.email ?? sessionData.session.user.email ?? "",
  };

  const adminRole = (currentAdmin?.role ?? "moderator") as AdminRole;

  return (
    <AdminSidebarProvider>
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar
          locale={locale}
          currentUser={currentUser}
          liveOrderCount={liveOrderCount}
          adminRole={adminRole}
        />
        
        {/* Main Content Area - offset by sidebar width */}
        <AdminMainContent>
          {children}
        </AdminMainContent>
      </div>
    </AdminSidebarProvider>
  );
}
