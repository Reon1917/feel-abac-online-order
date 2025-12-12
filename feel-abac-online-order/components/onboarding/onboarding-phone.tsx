"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { saveOnboardingPhone } from "@/app/[lang]/onboarding/actions";

type PhoneStageState = { error?: string; ok?: boolean };

type OnboardingPhoneProps = {
  defaultPhone?: string | null;
  onSuccess: () => void;
};

export function OnboardingPhone({ defaultPhone, onSuccess }: OnboardingPhoneProps) {
  const [state, formAction, pending] = useActionState<PhoneStageState, FormData>(
    saveOnboardingPhone,
    {}
  );
  const [phone, setPhone] = useState(defaultPhone ?? "");

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
    if (state?.ok) {
      onSuccess();
    }
  }, [state?.error, state?.ok, onSuccess]);

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Step 2 of 3
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Add your phone</h2>
        <p className="text-sm text-slate-600">
          We&apos;ll use this only for order updates.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">
            Phone number
            <span className="ml-1 text-xs font-normal text-slate-500">
              (e.g. 0812345678 or +66812345678)
            </span>
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            placeholder="0812345678"
            required
          />
          <p className="text-xs text-slate-500">
            You can change this later in your profile.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Saving..." : "Continue to location"}
          </button>
        </div>
      </form>
    </section>
  );
}


