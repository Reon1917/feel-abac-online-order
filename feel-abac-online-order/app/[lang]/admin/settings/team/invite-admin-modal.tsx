"use client";

import { useState } from "react";
import { X, Shield, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

type AdminRole = "super_admin" | "admin" | "moderator";

type Admin = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

type InviteAdminModalProps = {
  onClose: () => void;
  onSuccess: (admin: Admin) => void;
};

const ROLE_OPTIONS: {
  value: AdminRole;
  label: string;
  description: string;
  icon: typeof Shield;
  color: string;
}[] = [
  {
    value: "moderator",
    label: "Moderator",
    description: "Order management, shop toggle, stock control",
    icon: User,
    color: "blue",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full access except team management",
    icon: Shield,
    color: "emerald",
  },
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Full access including team management",
    icon: ShieldCheck,
    color: "purple",
  },
];

export function InviteAdminModal({ onClose, onSuccess }: InviteAdminModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("moderator");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to add admin");
        return;
      }

      onSuccess(data.admin);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    if (!isSelected) {
      return "border-slate-200 bg-white hover:border-slate-300";
    }
    switch (color) {
      case "blue":
        return "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20";
      case "emerald":
        return "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20";
      case "purple":
        return "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20";
      default:
        return "border-slate-500 bg-slate-50 ring-2 ring-slate-500/20";
    }
  };

  const getIconClasses = (color: string, isSelected: boolean) => {
    if (!isSelected) return "text-slate-400";
    switch (color) {
      case "blue":
        return "text-blue-600";
      case "emerald":
        return "text-emerald-600";
      case "purple":
        return "text-purple-600";
      default:
        return "text-slate-600";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Add Team Member
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="mb-5">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user's email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-slate-500">
              The user must have an existing account to be added.
            </p>
          </div>

          {/* Role Selection */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select Role
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = role === option.value;
                const Icon = option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={clsx(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
                      getColorClasses(option.color, isSelected)
                    )}
                  >
                    <div
                      className={clsx(
                        "mt-0.5 rounded-lg p-1.5",
                        isSelected ? `bg-${option.color}-100` : "bg-slate-100"
                      )}
                    >
                      <Icon
                        className={clsx(
                          "h-4 w-4",
                          getIconClasses(option.color, isSelected)
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={clsx(
                          "text-sm font-medium",
                          isSelected ? "text-slate-900" : "text-slate-700"
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div
                        className={clsx(
                          "mt-1 h-2 w-2 rounded-full",
                          option.color === "blue" && "bg-blue-500",
                          option.color === "emerald" && "bg-emerald-500",
                          option.color === "purple" && "bg-purple-500"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? "Adding..." : "Add Team Member"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
