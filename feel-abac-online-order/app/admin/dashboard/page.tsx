import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminManagement } from "@/components/admin/admin-management";
import { AdminList } from "@/components/admin/admin-list";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export default async function AdminDashboard() {
  const sessionData = await getSession();
  
  if (!sessionData?.isAdmin) {
    redirect("/");
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600">
              Welcome, {sessionData.session.user.name}
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/menu">View Menu as Customer</Link>
            </Button>
            <SignOutButton variant="ghost" />
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Orders</h2>
            <p className="text-sm text-slate-600">Manage incoming orders</p>
          </div>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Menu</h2>
            <p className="text-sm text-slate-600">Update menu items</p>
          </div>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
            <p className="text-sm text-slate-600">Configure system</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <AdminManagement isSuperAdmin={isSuperAdmin} />
          <AdminList 
            initialAdmins={adminList} 
            currentUserId={sessionData.session.user.id}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </div>
    </div>
  );
}

