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

export function PromptPayAccountsClient({
  initialAccounts,
  dictionary,
}: Props) {
  const [accounts, setAccounts] = useState<PromptPayAccountRecord[]>(() =>
    sortAccounts(initialAccounts)
  );
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activate, setActivate] = useState(initialAccounts.length === 0);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const hasActiveAccount = useMemo(
    () => accounts.some((account) => account.isActive),
    [accounts]
  );

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizePromptPayPhone(phoneNumber);
    if (!normalized) {
      toast.error(dictionary.invalidPhone);
      return;
    }

    startSaving(async () => {
      try {
        const response = await fetch("/api/admin/promptpay-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phoneNumber: normalized,
            activate: activate || !hasActiveAccount,
          }),
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
        setName("");
        setPhoneNumber("");
        setActivate(false);
        toast.success(dictionary.toastSaved);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : dictionary.invalidPhone);
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Main account"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold text-slate-700">
              {dictionary.phoneLabel}
            </span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="09XXXXXXXX"
              inputMode="numeric"
              maxLength={14}
            />
          </label>
        </div>

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
                    {account.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        {dictionary.activeBadge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-700">
                    {formatPromptPayPhoneForDisplay(account.phoneNumber)}
                  </p>
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
