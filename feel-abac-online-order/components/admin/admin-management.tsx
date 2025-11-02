"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AdminManagement({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to add admin");
        setIsLoading(false);
        return;
      }

      toast.success(data.message);
      setEmail("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-slate-600">
          Only super admins can manage admin users.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Add New Admin
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Add existing users as super admins. They must have an account first.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <p className="text-xs text-slate-500">
            User must already have a registered account
          </p>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {isLoading ? "Adding..." : "Add as Super Admin"}
        </Button>
      </form>
    </div>
  );
}

