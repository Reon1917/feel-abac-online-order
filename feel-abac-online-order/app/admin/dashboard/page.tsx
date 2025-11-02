import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAdminByUserId } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <div className="admin-light-surface min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Admin workspace
            </span>
            <h1 className="text-3xl font-semibold">Welcome back, {sessionData.session.user.name}</h1>
            <p className="text-sm text-slate-600">
              Choose a focus area below to reveal the tools—you see details only when you need them.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/menu">View customer side</Link>
            </Button>
            <SignOutButton variant="ghost" />
          </div>
        </header>

        <AdminWorkspace
          adminList={adminList}
          currentUserId={sessionData.session.user.id}
          isSuperAdmin={isSuperAdmin ?? false}
        />
      </div>
    </div>
  );
}

