"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { emailSchema } from "@/lib/validations";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type ForgotPasswordDictionary = typeof import("@/dictionaries/en/auth.json")["forgotPassword"];

type ForgotPasswordFormProps = {
  locale: Locale;
  labels: ForgotPasswordDictionary;
};

export function ForgotPasswordForm({ locale, labels }: ForgotPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setError(firstIssue?.message ?? labels.genericError);
      toast.error(firstIssue?.message ?? labels.genericError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: parsed.data }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      const message =
        data?.message ?? labels.successMessage ?? labels.genericSuccess;

      toast.success(message);
      router.push(withLocalePath(locale, "/"));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[forgot-password] request failed", err);
      }
      setError(labels.genericError);
      toast.error(labels.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const backTarget = searchParams.get("from") === "profile" ? "/profile" : "/";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="flex flex-col gap-1 text-sm">
        <label
          htmlFor="email"
          className="font-medium text-slate-800"
        >
          {labels.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={labels.emailPlaceholder}
          className={`rounded-md border px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300"
          }`}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <p className="mt-1 text-xs text-slate-500">
          {labels.subtitle}
        </p>
      </div>

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
            router.push(withLocalePath(locale, backTarget));
          }}
          className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          {labels.backToSignInLabel}
        </button>
      </div>
    </form>
  );
}
