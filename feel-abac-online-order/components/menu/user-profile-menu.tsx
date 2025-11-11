"use client";

import { useState } from "react";
import { MenuIcon, Mail, Phone, User2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PhoneEditModalClient } from "@/components/menu/phone-edit-modal-client";
import { cn } from "@/lib/utils";

export type ProfileMenuLabels = {
  trigger: string;
  title: string;
  description: string;
  signedInAs: string;
  phone: string;
  email: string;
};

type UserProfileMenuProps = {
  name: string | null | undefined;
  email: string | null | undefined;
  phoneNumber: string | null | undefined;
  labels: ProfileMenuLabels;
  className?: string;
};

export function UserProfileMenu({
  name,
  email,
  phoneNumber,
  labels,
  className,
}: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);

  const resolvedLabels: ProfileMenuLabels = {
    trigger: labels?.trigger ?? "Profile",
    title: labels?.title ?? "Your profile",
    description: labels?.description ?? "Review your account details and quick actions.",
    signedInAs: labels?.signedInAs ?? "Signed in as",
    phone: labels?.phone ?? "Phone",
    email: labels?.email ?? "Email",
  };

  const cleanedName = name?.trim() ?? "";
  const cleanedEmail = email?.trim() ?? "";
  const cleanedPhone = phoneNumber?.trim() ?? "";

  const displayName = cleanedName.length > 0 ? cleanedName : "Guest";
  const displayEmail = cleanedEmail.length > 0 ? cleanedEmail : "—";
  const displayPhone = cleanedPhone.length > 0 ? cleanedPhone : "—";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={resolvedLabels.trigger}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400 sm:px-4",
            className
          )}
        >
          <MenuIcon className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            {resolvedLabels.trigger}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm space-y-6 rounded-3xl border border-emerald-100 bg-white/95 p-7 text-slate-900 shadow-xl backdrop-blur-md sm:max-w-md">
        <DialogHeader className="space-y-2 text-left text-slate-900">
          <DialogTitle className="text-xl font-semibold">
            {resolvedLabels.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {resolvedLabels.description}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-800">
              <User2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs font-medium uppercase tracking-wide text-emerald-700">
                {resolvedLabels.signedInAs}
              </p>
              <p className="truncate text-sm text-slate-600">{displayEmail}</p>
            </div>
          </div>

          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolvedLabels.phone}
                </dt>
                <dd className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <span className="truncate">{displayPhone}</span>
                  <PhoneEditModalClient currentPhone={cleanedPhone} />
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resolvedLabels.email}
                </dt>
                <dd className="text-sm font-medium text-slate-900">{displayEmail}</dd>
              </div>
            </div>
          </dl>
        </section>

        <div className="flex justify-end">
          <SignOutButton variant="ghost" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
