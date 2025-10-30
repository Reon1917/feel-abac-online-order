"use client";

import { useFormState } from "react-dom";
import { completeOnboarding } from "@/app/onboarding/actions";

export function OnboardingForm({
  defaultPhone,
}: {
  defaultPhone?: string | null;
}) {
  const [state, action] = useFormState(completeOnboarding, null);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:max-w-lg"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">
          Share a phone number for order updates
        </h2>
        <p className="text-sm text-slate-600">
          We&apos;ll use this to confirm items or pickup times if something
          changes.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-800">Phone number</span>
        <input
          required
          type="tel"
          name="phoneNumber"
          defaultValue={defaultPhone ?? ""}
          placeholder="+66 8X-XXX-XXXX"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </label>
      {state?.error ? (
        <p className="text-sm font-medium text-red-600">{state.error}</p>
      ) : null}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700"
      >
        Save and continue
      </button>
    </form>
  );
}
