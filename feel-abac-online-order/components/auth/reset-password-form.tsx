"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { passwordSchema } from "@/lib/validations";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type ResetPasswordDictionary = typeof import("@/dictionaries/en/auth.json")["resetPassword"];

type ResetPasswordFormProps = {
  locale: Locale;
  labels: ResetPasswordDictionary;
  initialToken?: string;
  initialErrorCode?: string;
};

export function ResetPasswordForm({
  locale,
  labels,
  initialToken,
  initialErrorCode,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [token] = useState(initialToken ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasInitialTokenError =
    !initialToken && initialErrorCode && initialErrorCode.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors: Record<string, string> = {};

    if (!token) {
      errors.token = labels.tokenMissingError;
    }

    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      const firstIssue = passwordValidation.error.issues[0];
      errors.newPassword = firstIssue?.message ?? labels.genericError;
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = labels.passwordMismatchError;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(labels.genericError);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; field?: string }
        | null;

      if (!response.ok) {
        const field = data?.field;
        const message = data?.message ?? labels.genericError;

        if (field) {
          setFieldErrors((previous) => ({
            ...previous,
            [field]: message,
          }));
        }

        toast.error(message);
        return;
      }

      toast.success(labels.successMessage);
      router.push(withLocalePath(locale, "/"));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[reset-password] request failed", error);
      }
      toast.error(labels.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {hasInitialTokenError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {labels.tokenInvalidError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1 text-sm">
        <label
          htmlFor="new-password"
          className="font-medium text-slate-800"
        >
          {labels.newPasswordLabel}
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder={labels.newPasswordPlaceholder}
          className={`rounded-md border px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
            fieldErrors.newPassword
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300"
          }`}
        />
        {fieldErrors.newPassword ? (
          <p className="text-xs text-red-600">{fieldErrors.newPassword}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <label
          htmlFor="confirm-password"
          className="font-medium text-slate-800"
        >
          {labels.confirmPasswordLabel}
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder={labels.confirmPasswordPlaceholder}
          className={`rounded-md border px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
            fieldErrors.confirmPassword
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300"
          }`}
        />
        {fieldErrors.confirmPassword ? (
          <p className="text-xs text-red-600">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      <input
        type="hidden"
        name="token"
        value={token}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400"
        >
          {isSubmitting ? labels.submittingLabel : labels.submitLabel}
        </Button>

        <button
          type="button"
          onClick={() => {
            router.push(withLocalePath(locale, "/"));
          }}
          className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          {labels.backToHomeLabel}
        </button>
      </div>
    </form>
  );
}
