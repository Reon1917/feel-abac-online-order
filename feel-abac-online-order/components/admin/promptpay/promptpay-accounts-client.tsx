'use client';

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { toast } from "sonner";

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
  const [billerId, setBillerId] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [activate, setActivate] = useState(initialAccounts.length === 0);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const hasActiveAccount = useMemo(
    () => accounts.some((account) => account.isActive),
    [accounts]
  );

  const resetForm = () => {
    setName("");
    setPhoneNumber("");
    setBillerId("");
    setRef1("");
    setRef2("");
    setActivate(false);
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
          ) : (
            /* Conditional: Biller ID (Bill Payment) */
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-slate-700">
                {dictionary.billerIdLabel}
              </span>
              <input
                type="text"
                value={billerId}
                onChange={(event) => setBillerId(event.target.value)}
                required
                className={inputClass}
                placeholder="010753600107930"
                maxLength={15}
              />
            </label>
          )}
        </div>

        {/* Bill Payment: ref1 + ref2 */}
        {accountType === "billpayment" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-slate-700">
                {dictionary.ref1Label}
              </span>
              <input
                type="text"
                value={ref1}
                onChange={(event) => setRef1(event.target.value)}
                required
                className={inputClass}
                placeholder="070000603025218"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-slate-700">
                {dictionary.ref2Label}
              </span>
              <input
                type="text"
                value={ref2}
                onChange={(event) => setRef2(event.target.value)}
                className={inputClass}
                placeholder="33036780"
              />
            </label>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
