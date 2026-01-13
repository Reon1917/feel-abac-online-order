"use client";

import { useEffect, useState, useMemo } from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { saveOnboardingPhone } from "@/app/[lang]/onboarding/actions";

type PhoneStageState = { error?: string; ok?: boolean };

type OnboardingPhoneProps = {
  defaultPhone?: string | null;
  onSuccess: () => void;
};

// Thai phone number validation regex
const THAI_PHONE_REGEX = /^(\+66[0-9]{9}|0[0-9]{9})$/;

function validatePhone(value: string): { valid: boolean; message: string } {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return { valid: false, message: "" };
  }
  
  // Check if it matches the expected format
  if (THAI_PHONE_REGEX.test(trimmed)) {
    return { valid: true, message: "Valid Thai phone number" };
  }
  
  // Provide helpful feedback based on what's wrong
  if (trimmed.startsWith("+") && !trimmed.startsWith("+66")) {
    return { valid: false, message: "Thai numbers start with +66" };
  }
  
  if (trimmed.startsWith("+66")) {
    const digits = trimmed.slice(3);
    if (digits.length < 9) {
      return { valid: false, message: `Need ${9 - digits.length} more digit${9 - digits.length > 1 ? "s" : ""} after +66` };
    }
    if (digits.length > 9) {
      return { valid: false, message: "Too many digits after +66" };
    }
    if (!/^[0-9]+$/.test(digits)) {
      return { valid: false, message: "Only numbers allowed after +66" };
    }
  }
  
  if (trimmed.startsWith("0")) {
    const digits = trimmed;
    if (digits.length < 10) {
      return { valid: false, message: `Need ${10 - digits.length} more digit${10 - digits.length > 1 ? "s" : ""}` };
    }
    if (digits.length > 10) {
      return { valid: false, message: "Thai mobile numbers are 10 digits" };
    }
    if (!/^[0-9]+$/.test(digits)) {
      return { valid: false, message: "Only numbers allowed" };
    }
  }
  
  if (/^[0-9]+$/.test(trimmed) && !trimmed.startsWith("0")) {
    return { valid: false, message: "Start with 0 or +66" };
  }
  
  return { valid: false, message: "Use format: 0812345678 or +66812345678" };
}

export function OnboardingPhone({ defaultPhone, onSuccess }: OnboardingPhoneProps) {
  const [state, formAction, pending] = useActionState<PhoneStageState, FormData>(
    saveOnboardingPhone,
    {}
  );
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validatePhone(phone), [phone]);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
    if (state?.ok) {
      onSuccess();
    }
  }, [state?.error, state?.ok, onSuccess]);

  const showValidation = touched && phone.length > 0;

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

      {/* Format reminder box */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-blue-800">Thai phone number format</p>
          <ul className="space-y-0.5 text-blue-700">
            <li>• <span className="font-mono">0812345678</span> — 10 digits starting with 0</li>
            <li>• <span className="font-mono">+66812345678</span> — +66 followed by 9 digits</li>
          </ul>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="space-y-2">
          <label htmlFor="phoneNumber" className="text-sm font-semibold text-slate-800">
            Phone number
          </label>
          <div className="relative">
            <input
              id="phoneNumber"
              type="tel"
              name="phoneNumber"
              value={phone}
              onChange={(e) => {
                // Only allow digits, + sign, and limit length
                const value = e.target.value.replace(/[^\d+]/g, "");
                if (value.length <= 13) {
                  setPhone(value);
                }
              }}
              onBlur={() => setTouched(true)}
              className={`w-full rounded-xl border bg-white px-4 py-3 pr-10 text-base text-slate-900 shadow-inner transition-colors focus:outline-none focus:ring-2 ${
                showValidation
                  ? validation.valid
                    ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100"
                    : "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                  : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100"
              }`}
              placeholder="0812345678"
              inputMode="tel"
              autoComplete="tel"
              required
            />
            {showValidation && (
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {validation.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
            )}
          </div>
          
          {/* Validation message */}
          {showValidation && validation.message && (
            <p className={`flex items-center gap-1.5 text-xs ${
              validation.valid ? "text-emerald-600" : "text-amber-600"
            }`}>
              {validation.valid ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {validation.message}
            </p>
          )}
          
          <p className="text-xs text-slate-500">
            You can change this later in your profile.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={pending || (touched && !validation.valid)}
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Saving..." : "Continue to location"}
          </button>
        </div>
      </form>
    </section>
  );
}









