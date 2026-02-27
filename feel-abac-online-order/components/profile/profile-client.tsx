"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  KeyRound,
  Languages,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Shield,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";
import { MenuLanguageToggle } from "@/components/i18n/menu-language-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateNameAction,
  updatePhoneAction,
} from "@/app/[lang]/profile/actions";
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
  linkedProviders: string[];
  dictionary: ProfileDictionary;
  common: CommonDictionary;
  locale: Locale;
};

type DeleteAccountResponse = {
  success?: boolean;
  message?: string;
  status?: "verification_sent" | "deleted";
  verificationSent?: boolean;
};

const DELETE_CONFIRM_VALUE = "DELETE";
const DELETE_REQUEST_TIMEOUT_MS = 12_000;

export function ProfileClient({
  user,
  phone,
  hasPassword,
  linkedProviders,
  dictionary,
  common,
  locale,
}: ProfileClientProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentName, setCurrentName] = useState(user.name ?? "");
  const [nameValue, setNameValue] = useState(user.name ?? "");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [currentPhone, setCurrentPhone] = useState(phone);
  const [phoneValue, setPhoneValue] = useState(phone);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const [nameState, nameFormAction] = useActionState(updateNameAction, null);
  const [phoneState, phoneFormAction] = useActionState(updatePhoneAction, null);
  const { sections, toast: toastMessages } = dictionary;

  const hasGoogle = linkedProviders.includes("google");

  const authMethods = useMemo(() => {
    const methods: string[] = [];

    if (hasPassword) {
      methods.push(sections.security.passwordMethodLabel);
    }

    if (hasGoogle) {
      methods.push(sections.security.googleMethodLabel);
    }

    if (methods.length === 0) {
      methods.push(sections.security.unknownMethodLabel);
    }

    return methods;
  }, [hasGoogle, hasPassword, sections.security]);

  useEffect(() => {
    const normalizedName = user.name ?? "";
    setCurrentName(normalizedName);
    setNameValue(normalizedName);
  }, [user.name]);

  useEffect(() => {
    setCurrentPhone(phone);
    setPhoneValue(phone);
  }, [phone]);

  useEffect(() => {
    if (nameState?.success) {
      const normalizedName = nameValue.trim();
      setCurrentName(normalizedName);
      setNameValue(normalizedName);
      toast.success(toastMessages.nameUpdated);
      setIsEditingName(false);
      router.refresh();
      return;
    }

    if (nameState?.error) {
      toast.error(nameState.error);
    }
  }, [nameState, nameValue, router, toastMessages.nameUpdated]);

  useEffect(() => {
    if (phoneState?.success) {
      setCurrentPhone(phoneValue);
      toast.success(toastMessages.phoneUpdated);
      setIsEditingPhone(false);
      return;
    }

    if (phoneState?.error) {
      toast.error(phoneState.error);
    }
  }, [phoneState, phoneValue, toastMessages.phoneUpdated]);

  const handleCancelNameEdit = () => {
    setNameValue(currentName);
    setIsEditingName(false);
  };

  const handleCancelPhoneEdit = () => {
    setPhoneValue(currentPhone);
    setIsEditingPhone(false);
  };

  const resetDeleteDraft = () => {
    setDeletePassword("");
    setDeleteConfirm("");
    setDeleteError(null);
  };

  const handleOpenDeleteDialog = () => {
    resetDeleteDraft();
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeletingAccount) return;
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== DELETE_CONFIRM_VALUE) {
      setDeleteError(toastMessages.deleteConfirmMismatch);
      toast.error(toastMessages.deleteConfirmMismatch);
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, DELETE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          password: hasPassword && deletePassword.trim().length > 0 ? deletePassword : undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | DeleteAccountResponse
        | null;

      if (!response.ok || !data?.success) {
        const message = data?.message ?? toastMessages.accountDeleteError;
        setDeleteError(message);
        toast.error(message);
        return;
      }

      const wasVerificationFlow =
        data.status === "verification_sent" || data.verificationSent === true;
      const successMessage = wasVerificationFlow
        ? toastMessages.accountDeleteVerificationSent
        : toastMessages.accountDeleted;

      setDeleteStatus(successMessage);
      toast.success(successMessage);
      setIsDeleteDialogOpen(false);
      resetDeleteDraft();

      if (!wasVerificationFlow) {
        router.push(withLocalePath(locale, "/"));
        router.refresh();
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[profile] delete account failed", error);
      }

      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? toastMessages.requestTimeout
          : toastMessages.accountDeleteError;
      setDeleteError(message);
      toast.error(message);
    } finally {
      window.clearTimeout(timeoutId);
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {dictionary.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{dictionary.subtitle}</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              {sections.account.title}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <User className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">
                  {sections.account.name}
                </p>
                {isEditingName ? (
                  <form action={nameFormAction} className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      name="name"
                      value={nameValue}
                      onChange={(event) => setNameValue(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder={sections.account.namePlaceholder}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200"
                      title={sections.account.saveName}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelNameEdit}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      title={sections.account.cancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {currentName || "-"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="flex h-7 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      <Pencil className="h-3 w-3" />
                      {sections.account.editName}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">
                  {sections.account.email}
                </p>
                <p className="truncate text-sm font-medium text-slate-900">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <Phone className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">
                  {sections.account.phone}
                </p>
                {isEditingPhone ? (
                  <form action={phoneFormAction} className="mt-1 flex items-center gap-2">
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={phoneValue}
                      onChange={(event) => setPhoneValue(event.target.value)}
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
                      onClick={handleCancelPhoneEdit}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      title={sections.account.cancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{currentPhone}</p>
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

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              {sections.preferences.title}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
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

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Shield className="h-4 w-4 text-emerald-600" />
              {sections.security.title}
            </h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
            <p className="text-xs text-slate-500">{sections.security.description}</p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-700" />
                <p className="text-xs font-semibold text-slate-800">
                  {sections.security.authMethodTitle}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {authMethods.map((method) => (
                  <span
                    key={method}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {method}
                  </span>
                ))}
              </div>

              {hasPassword ? (
                <Button asChild size="sm" className="mt-3">
                  <Link href={`${withLocalePath(locale, "/auth/forgot-password")}?from=profile`}>
                    {sections.security.resetPasswordButton}
                  </Link>
                </Button>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  {sections.security.googleOnlyResetHint}
                </p>
              )}

              {hasPassword && hasGoogle ? (
                <p className="mt-2 text-xs text-amber-700">
                  {sections.security.multipleMethodsWarning}
                </p>
              ) : null}
            </div>

            <p className="text-xs text-slate-500">{sections.security.passwordResetHint}</p>
          </div>
        </section>

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

            {!hasPassword ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {sections.dangerZone.oauthDeleteHint}
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {sections.dangerZone.passwordOptionalHint}
              </p>
            )}

            <Button
              type="button"
              onClick={handleOpenDeleteDialog}
              variant="destructive"
              className="h-9 rounded-full px-4 text-xs font-semibold"
            >
              {sections.dangerZone.openDialogButton}
            </Button>

            <p className="text-[11px] text-slate-500">
              {sections.dangerZone.subtitle}
            </p>

            {deleteStatus ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {deleteStatus}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsDeleteDialogOpen(true);
            return;
          }
          handleCloseDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sections.dangerZone.modalTitle}</DialogTitle>
            <DialogDescription>
              {sections.dangerZone.modalDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {hasPassword ? (
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-800">
                  {sections.dangerZone.passwordOptionalLabel}
                </span>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder={sections.dangerZone.passwordPlaceholder}
                  className="h-9"
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-800">
                {sections.dangerZone.confirmLabel}
              </span>
              <Input
                type="text"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder={sections.dangerZone.confirmPlaceholder}
                className="h-9"
                autoFocus
              />
            </label>

            {deleteError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {deleteError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDeleteDialog}
              disabled={isDeletingAccount}
            >
              {sections.dangerZone.cancelDeleteButton}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount || deleteConfirm !== DELETE_CONFIRM_VALUE}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {sections.dangerZone.deletingLabel}
                </>
              ) : (
                sections.dangerZone.confirmDeleteButton
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
