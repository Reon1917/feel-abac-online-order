"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";

export function OnboardingForm({
  defaultPhone,
}: {
  defaultPhone?: string | null;
}) {
  const [state, action] = useActionState(completeOnboarding, null);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.error]);

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
          type="tel"
          name="phoneNumber"
          defaultValue={defaultPhone ?? ""}
          placeholder="0812345678 or +66812345678"
          className={`rounded-md border bg-white px-3 py-2 text-slate-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
            state?.error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-slate-200"
          }`}
        />
        {state?.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </label>
      <Button
        type="submit"
        className="w-full bg-emerald-600 text-white shadow hover:bg-emerald-700"
      >
        Save and continue
      </Button>
    </form>
  );
}
