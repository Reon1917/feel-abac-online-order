"use client";

import { useEffect, useState, useActionState } from "react";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Languages,
  LogOut,
  Pencil,
  Check,
  X,
  ChevronRight,
  ShoppingBag,
  Shield,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import { updatePhoneAction } from "@/app/[lang]/profile/actions";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type ProfileDictionary = typeof import("@/dictionaries/en/profile.json");
type CommonDictionary = typeof import("@/dictionaries/en/common.json");

type ProfileClientProps = {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  phone: string;
  hasPassword: boolean;
  dictionary: ProfileDictionary;
  common: CommonDictionary;
  locale: Locale;
};

export function ProfileClient({
  user,
  phone,
  hasPassword,
  dictionary,
  common,
  locale,
}: ProfileClientProps) {
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [state, formAction] = useActionState(updatePhoneAction, null);

  const { sections, toast: toastMessages } = dictionary;

  useEffect(() => {
    if (state?.success) {
      toast.success(toastMessages.phoneUpdated);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditingPhone(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toastMessages.phoneUpdated]);

  const handleCancelEdit = () => {
    setPhoneValue(phone);
    setIsEditingPhone(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error(toastMessages.deleteConfirmMismatch);
      return;
    }

    // For users with password, require password entry
    if (hasPassword && !deletePassword) {
      toast.error(toastMessages.passwordRequired);
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Only send password if user has one; OAuth-only users get email verification
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: hasPassword ? deletePassword : undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
          }
        | null;

      if (!response.ok) {
        const message =
          data?.message ?? toastMessages.accountDeleteError;
        toast.error(message);
        return;
      }

      if (data?.message === "Verification email sent") {
        toast.success(toastMessages.accountDeleteVerificationSent);
      } else {
        toast.success(toastMessages.accountDeleted);
      }

      setDeletePassword("");
      setDeleteConfirm("");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[profile] delete account failed", error);
      }
      toast.error(toastMessages.accountDeleteError);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {dictionary.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{dictionary.subtitle}</p>
      </div>

      {/* Account Information Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {sections.account.title}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {/* Name */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <User className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500">
                {sections.account.name}
              </p>
              <p className="truncate text-sm font-medium text-slate-900">
                {user.name || "—"}
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500">
                {sections.account.email}
              </p>
              <p className="truncate text-sm font-medium text-slate-900">
                {user.email}
              </p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
              <Phone className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500">
                {sections.account.phone}
              </p>
              {isEditingPhone ? (
                <form action={formAction} className="mt-1 flex items-center gap-2">
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder={sections.account.phonePlaceholder}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200"
                    title={sections.account.savePhone}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    title={sections.account.cancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{phone}</p>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="flex h-7 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                  >
                    <Pencil className="h-3 w-3" />
                    {sections.account.editPhone}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {sections.preferences.title}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {/* App Language */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50">
              <Languages className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex flex-1 items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {sections.preferences.language}
              </p>
              <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
            </div>
          </div>

          {/* Menu Language */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
              <Languages className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex flex-1 items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {sections.preferences.menuLanguage}
              </p>
              <MenuLanguageToggle
                labels={common.menuLanguageToggle}
                dropdownAlign="end"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Security Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            {sections.security.title}
          </h2>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">
          <p className="text-xs text-slate-500">
            {sections.security.description}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {sections.security.passwordResetHint}
          </p>
        </div>
      </section>

      {/* Order History Link */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Link
          href={withLocalePath(locale, "/orders")}
          className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <ShoppingBag className="h-5 w-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {sections.orderHistory.title}
            </p>
            <p className="text-xs text-slate-500">
              {sections.orderHistory.viewAll}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
      </section>

      {/* Sign Out Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {sections.actions.title}
          </h2>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <LogOut className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {sections.actions.signOut}
              </p>
              <p className="text-xs text-slate-500">
                {sections.actions.signOutDescription}
              </p>
            </div>
            <SignOutButton variant="outline" />
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {sections.dangerZone.title}
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-red-700">
            {sections.dangerZone.description}
          </p>
          {/* OAuth-only users see email verification flow hint */}
          {!hasPassword && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
              {sections.dangerZone.oauthDeleteHint}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),auto] sm:items-end">
            <div className="space-y-2">
              {/* Only show password field if user has a password */}
              {hasPassword && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-slate-800">
                    {sections.dangerZone.passwordLabel}
                  </span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder={sections.dangerZone.passwordPlaceholder}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-800">
                  {sections.dangerZone.confirmLabel}
                </span>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={sections.dangerZone.confirmPlaceholder}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                {sections.dangerZone.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount}
              className="h-9 rounded-full border border-red-300 bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-red-400 disabled:text-white"
            >
              {isDeletingAccount
                ? sections.dangerZone.deletingLabel
                : hasPassword
                  ? sections.dangerZone.deleteButton
                  : sections.dangerZone.sendVerificationButton}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
