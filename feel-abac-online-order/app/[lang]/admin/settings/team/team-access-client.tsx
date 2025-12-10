"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableEmpty,
  DataTablePagination,
} from "@/components/admin/data-table";
import { StatusBadge, RoleBadge } from "@/components/admin/status-badge";
import { InviteAdminModal } from "./invite-admin-modal";

type Admin = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

type TeamAccessClientProps = {
  initialAdmins: Admin[];
  currentUserId: string;
  isSuperAdmin: boolean;
};

const ITEMS_PER_PAGE = 10;

export function TeamAccessClient({
  initialAdmins,
  currentUserId,
  isSuperAdmin,
}: TeamAccessClientProps) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [removing, setRemoving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const totalPages = Math.ceil(admins.length / ITEMS_PER_PAGE);
  const paginatedAdmins = admins.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRemoving(null);
    }
  };

  const refreshList = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/list");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          (payload && typeof payload.error === "string" && payload.error) ||
          "Failed to refresh admin list";
        toast.error(message);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!Array.isArray(payload)) {
        toast.error("Failed to refresh admin list");
        return;
      }

      setAdmins(payload);
      toast.success("Admin list refreshed");
    } catch {
      toast.error("Network error while refreshing admin list");
    } finally {
      setRefreshing(false);
    }
  };

  const handleInviteSuccess = (newAdmin: Admin) => {
    setAdmins([...admins, newAdmin]);
    setShowInviteModal(false);
    toast.success(`${newAdmin.name} added as admin`);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Header with actions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Current Admins ({admins.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshList}
            disabled={refreshing}
            className="gap-2"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh List
          </Button>
          {isSuperAdmin && (
            <Button
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Invite New Admin
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <DataTable>
        <DataTableHeader>
          <DataTableHead className="w-[40%]">User</DataTableHead>
          <DataTableHead>Role</DataTableHead>
          <DataTableHead>Status</DataTableHead>
          <DataTableHead className="text-right">Actions</DataTableHead>
        </DataTableHeader>
        <DataTableBody>
          {paginatedAdmins.length === 0 ? (
            <DataTableEmpty message="No admins found" colSpan={4} />
          ) : (
            paginatedAdmins.map((admin) => {
              const isCurrentUser = admin.userId === currentUserId;
              const canRemove = isSuperAdmin && !isCurrentUser;

              return (
                <DataTableRow key={admin.id}>
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                        {getInitials(admin.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{admin.name}</p>
                        <p className="text-sm text-slate-500">{admin.email}</p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <RoleBadge role={admin.role} />
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      variant={admin.isActive ? "active" : "inactive"}
                      label={admin.isActive ? "Active" : "Inactive"}
                    />
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {isCurrentUser ? (
                      <span className="text-sm italic text-slate-400">It&apos;s You</span>
                    ) : canRemove ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(admin.userId)}
                        disabled={removing === admin.userId}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {removing === admin.userId ? "Removing..." : "Remove"}
                      </Button>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              );
            })
          )}
        </DataTableBody>
      </DataTable>

      {/* Pagination */}
      {totalPages > 1 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={admins.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteAdminModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </>
  );
}
