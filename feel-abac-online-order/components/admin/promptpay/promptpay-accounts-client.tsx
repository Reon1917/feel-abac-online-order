'use client';

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { parse } from "promptparse";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type adminPromptpayDictionary from "@/dictionaries/en/admin-promptpay.json";
import type { PromptPayAccountRecord } from "@/lib/payments/queries";
import {
  formatPromptPayPhoneForDisplay,
  normalizePromptPayPhone,
} from "@/lib/payments/promptpay";

type Dictionary = typeof adminPromptpayDictionary;
type AccountType = "anyid" | "billpayment";

type Props = {
  initialAccounts: PromptPayAccountRecord[];
  dictionary: Dictionary;
};

function sortAccounts(list: PromptPayAccountRecord[]) {
  return [...list].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

function AccountTypeLabel({
  accountType,
  dictionary,
}: {
  accountType: string;
  dictionary: Dictionary;
}) {
  const isBill = accountType === "billpayment";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        isBill
          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
          : "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
      )}
    >
      {isBill ? dictionary.billPaymentBadge : dictionary.anyIdBadge}
    </span>
  );
}

function AccountDetail({ account }: { account: PromptPayAccountRecord }) {
  if (account.accountType === "billpayment") {
    return (
      <div className="space-y-0.5 text-sm text-slate-600">
        <p>Biller: {account.billerId}</p>
        <p>Ref1: {account.ref1}</p>
        {account.ref2 ? <p>Ref2: {account.ref2}</p> : null}
      </div>
    );
  }
  return (
    <p className="text-sm text-slate-700">
      {formatPromptPayPhoneForDisplay(account.phoneNumber)}
    </p>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function PromptPayAccountsClient({
  initialAccounts,
  dictionary,
}: Props) {
  const [accounts, setAccounts] = useState<PromptPayAccountRecord[]>(() =>
    sortAccounts(initialAccounts)
  );
  const [accountType, setAccountType] = useState<AccountType>("anyid");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [qrRawInput, setQrRawInput] = useState("");
  const [billerId, setBillerId] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [qrParsed, setQrParsed] = useState(false);
  const [activate, setActivate] = useState(initialAccounts.length === 0);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromptPayAccountRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const hasActiveAccount = useMemo(
    () => accounts.some((account) => account.isActive),
    [accounts]
  );

  const resetForm = () => {
    setName("");
    setPhoneNumber("");
    setQrRawInput("");
    setBillerId("");
    setRef1("");
    setRef2("");
    setQrParsed(false);
    setActivate(false);
  };

  const handleQrPaste = (raw: string) => {
    setQrRawInput(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setBillerId("");
      setRef1("");
      setRef2("");
      setQrParsed(false);
      return;
    }
    try {
      const data = parse(trimmed);
      if (!data) {
        toast.error(dictionary.qrParseError);
        setQrParsed(false);
        return;
      }
      const tag30raw = data.getTagValue("30");
      if (!tag30raw) {
        toast.error(dictionary.qrParseNoTag30);
        setQrParsed(false);
        return;
      }
      const tag30 = parse(tag30raw);
      if (!tag30) {
        toast.error(dictionary.qrParseError);
        setQrParsed(false);
        return;
      }
      const parsedBillerId = tag30.getTagValue("01") ?? "";
      const parsedRef1 = tag30.getTagValue("02") ?? "";
      const parsedRef2 = tag30.getTagValue("03") ?? "";
      if (!parsedBillerId || !parsedRef1) {
        toast.error(dictionary.qrParseMissingFields);
        setQrParsed(false);
        return;
      }
      setBillerId(parsedBillerId);
      setRef1(parsedRef1);
      setRef2(parsedRef2);
      setQrParsed(true);
      toast.success(dictionary.qrParseSuccess);
    } catch {
      toast.error(dictionary.qrParseError);
      setQrParsed(false);
    }
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (accountType === "anyid") {
      const normalized = normalizePromptPayPhone(phoneNumber);
      if (!normalized) {
        toast.error(dictionary.invalidPhone);
        return;
      }
    } else {
      if (!billerId.trim() || !ref1.trim()) {
        toast.error(dictionary.invalidBillPayment);
        return;
      }
    }

    startSaving(async () => {
      try {
        const body =
          accountType === "billpayment"
            ? {
                accountType: "billpayment",
                name: name.trim(),
                billerId: billerId.trim(),
                ref1: ref1.trim(),
                ref2: ref2.trim() || undefined,
                activate: activate || !hasActiveAccount,
              }
            : {
                accountType: "anyid",
                name: name.trim(),
                phoneNumber: normalizePromptPayPhone(phoneNumber)!,
                activate: activate || !hasActiveAccount,
              };

        const response = await fetch("/api/admin/promptpay-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to save account");
        }

        const newAccount = payload.account as PromptPayAccountRecord;
        setAccounts((prev) =>
          sortAccounts(
            newAccount.isActive
              ? [newAccount, ...prev.map((acc) => ({ ...acc, isActive: false }))]
              : [newAccount, ...prev]
          )
        );
        resetForm();
        toast.success(dictionary.toastSaved);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save");
      }
    });
  };

  const handleActivate = async (accountId: string) => {
    setActivatingId(accountId);
    try {
      const response = await fetch(
        `/api/admin/promptpay-accounts/${accountId}/activate`,
        { method: "PATCH" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to activate account");
      }
      const activated = payload.account as PromptPayAccountRecord;
      setAccounts((prev) =>
        sortAccounts(
          prev.map((acc) =>
            acc.id === activated.id
              ? { ...acc, isActive: true }
              : { ...acc, isActive: false }
          )
        )
      );
      toast.success(dictionary.toastActivated);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.activationFailed
      );
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/promptpay-accounts/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? dictionary.deleteFailed);
      }

      const nextActiveId =
        typeof payload?.activeAccount?.id === "string"
          ? payload.activeAccount.id
          : null;

      setAccounts((prev) =>
        sortAccounts(
          prev
            .filter((account) => account.id !== deleteTarget.id)
            .map((account) => ({
              ...account,
              isActive: nextActiveId !== null && account.id === nextActiveId,
            }))
        )
      );
      setDeleteTarget(null);
      toast.success(dictionary.toastDeleted);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.deleteFailed
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {dictionary.addSectionTitle}
            </h2>
            <p className="text-sm text-slate-600">{dictionary.createFirstHint}</p>
          </div>
        </div>

        {/* Account type toggle */}
        <div className="mt-4 space-y-1">
          <span className="block text-sm font-semibold text-slate-700">
            {dictionary.accountTypeLabel}
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setAccountType("anyid")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                accountType === "anyid"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {dictionary.anyIdOption}
            </button>
            <button
              type="button"
              onClick={() => setAccountType("billpayment")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                accountType === "billpayment"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {dictionary.billPaymentOption}
            </button>
          </div>
        </div>

        {/* Common: Name */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-semibold text-slate-700">
              {dictionary.nameLabel}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className={inputClass}
              placeholder="Main account"
            />
          </label>

          {/* Conditional: Phone (AnyID) */}
          {accountType === "anyid" ? (
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-slate-700">
                {dictionary.phoneLabel}
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                required
                className={inputClass}
                placeholder="09XXXXXXXX"
                inputMode="numeric"
                maxLength={14}
              />
            </label>
          ) : null}
        </div>

        {/* Bill Payment: paste QR data to auto-fill */}
        {accountType === "billpayment" ? (
          <div className="mt-4 space-y-4">
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-slate-700">
                {dictionary.qrDataLabel}
              </span>
              <p className="text-xs text-slate-500">{dictionary.qrDataHint}</p>
              <textarea
                value={qrRawInput}
                onChange={(event) => handleQrPaste(event.target.value)}
                className={clsx(inputClass, "min-h-[60px] font-mono text-xs")}
                placeholder="00020101021130700016A000000677..."
                rows={2}
              />
            </label>

            {qrParsed ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">
                  {dictionary.qrParseSuccess}
                </p>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-emerald-700">{dictionary.billerIdLabel}</span>
                    <p className="font-mono text-slate-900">{billerId}</p>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-700">{dictionary.ref1Label}</span>
                    <p className="font-mono text-slate-900">{ref1}</p>
                  </div>
                  {ref2 ? (
                    <div>
                      <span className="text-xs text-emerald-700">{dictionary.ref2Label}</span>
                      <p className="font-mono text-slate-900">{ref2}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <input
            id="activate-account"
            type="checkbox"
            checked={activate || (!hasActiveAccount && accounts.length === 0)}
            onChange={(event) => setActivate(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="activate-account" className="text-sm font-medium text-slate-700">
            {dictionary.activateLabel}
          </label>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? dictionary.saving : dictionary.saveAccount}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {dictionary.accountsTitle}
            </h2>
            <p className="text-sm text-slate-600">{dictionary.pageSubtitle}</p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">{dictionary.noAccounts}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {account.name}
                    </p>
                    <AccountTypeLabel
                      accountType={account.accountType}
                      dictionary={dictionary}
                    />
                    {account.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        {dictionary.activeBadge}
                      </span>
                    ) : null}
                  </div>
                  <AccountDetail account={account} />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      account.isActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {account.isActive ? dictionary.activeBadge : dictionary.inactiveBadge}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleActivate(account.id)}
                    disabled={account.isActive || activatingId === account.id}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {account.isActive
                      ? dictionary.activeBadge
                      : activatingId === account.id
                        ? "..."
                        : dictionary.setActive}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(account)}
                    disabled={activatingId === account.id || isDeleting}
                    className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {dictionary.deleteAccount}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-sm space-y-4">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {dictionary.deleteConfirmTitle}
            </DialogTitle>
            <DialogDescription>
              {(dictionary.deleteConfirmDescription ?? "")
                .replace("{{name}}", deleteTarget?.name ?? "")}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-900">
                {deleteTarget.name}
              </p>
              <div className="mt-1">
                <AccountDetail account={deleteTarget} />
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-row justify-end gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dictionary.deleteConfirmCancel}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? dictionary.deletePending : dictionary.deleteAccount}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
