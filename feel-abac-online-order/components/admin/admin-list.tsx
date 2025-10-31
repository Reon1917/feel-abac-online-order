"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Admin = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

export function AdminList({
  initialAdmins,
  currentUserId,
  isSuperAdmin,
}: {
  initialAdmins: Admin[];
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [removing, setRemoving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;

    setRemoving(userId);

    try {
      const response = await fetch("/api/admin/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to remove admin");
        setRemoving(null);
        return;
      }

      const removedAdmin = admins.find((a) => a.userId === userId);
      toast.success(`${removedAdmin?.name || "Admin"} removed successfully`);
      setAdmins(admins.filter((a) => a.userId !== userId));
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setRemoving(null);
    }
  };

  const refreshList = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/list");
      const data = await response.json();
      setAdmins(data);
      toast.success("Admin list refreshed");
    } catch (error) {
      toast.error("Failed to refresh admin list");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Current Admins ({admins.length})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshList}
          disabled={refreshing}
          className="text-xs"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="space-y-2">
        {admins.length === 0 ? (
          <p className="text-sm text-slate-500">No admins found</p>
        ) : (
          admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium text-slate-900">{admin.name}</p>
                <p className="text-sm text-slate-600">{admin.email}</p>
                <p className="text-xs text-slate-500">
                  Role: <span className="font-medium">{admin.role}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {admin.userId === currentUserId && (
                  <span className="text-xs font-medium text-emerald-600">You</span>
                )}
                {isSuperAdmin && admin.userId !== currentUserId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(admin.userId)}
                    disabled={removing === admin.userId}
                  >
                    {removing === admin.userId ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

