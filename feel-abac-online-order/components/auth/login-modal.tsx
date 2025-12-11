"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
  import { Button } from "@/components/ui/button";
import { signInSchema, signUpSchema } from "@/lib/validations";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";

type AuthView = "sign-in" | "sign-up";

type LoginModalProps = {
  locale: Locale;
};

export function LoginModal({ locale }: LoginModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("sign-in");
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const close = () => {
    setIsOpen(false);
    setValidationErrors({});
    setIsLoading(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = String(value);
    });

    setIsLoading(true);
    setValidationErrors({});

    // Client-side validation
    const schema = view === "sign-in" ? signInSchema : signUpSchema;
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[String(issue.path[0])] = issue.message;
        }
      });
      setValidationErrors(errors);
      toast.error("Please fix the errors in the form");
      setIsLoading(false);
      return;
    }

    const endpoint = view === "sign-in" ? "/api/sign-in" : "/api/sign-up";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMessage = data?.message || "Something went wrong. Please try again.";
        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }

      toast.success(view === "sign-in" ? "Welcome back!" : "Account created successfully!");
      close();
      router.push(`/${locale}/menu`);
      router.refresh();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("auth failed", err);
      }
      toast.error("Unable to reach the server. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setValidationErrors({});
    
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `/${locale}/menu`,
      });
      // OAuth redirects, so success toast will not show
      // The page will reload after OAuth callback
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Google sign-in failed", err);
      }
      
      // Handle specific OAuth errors
      const errorMessage = err instanceof Error ? err.message : "Google sign-in failed";
      
      if (errorMessage.includes("popup")) {
        toast.error("Please allow popups for this site to sign in with Google");
      } else if (errorMessage.includes("network")) {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Google sign-in failed. Please try again.");
      }
      
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="rounded-full border-emerald-200 bg-white px-5 py-2 text-emerald-900 shadow-sm hover:bg-emerald-50"
        variant="outline"
      >
        Log in / Sign up
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-950">
                {view === "sign-in" ? "Welcome back" : "Create an account"}
              </h2>
              <Button
                onClick={close}
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-emerald-700 hover:bg-emerald-50"
                aria-label="Close login modal"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              {view === "sign-up" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-emerald-900">
                    Full name
                  </span>
                  <input
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className={`rounded-md border px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                      validationErrors.name
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-emerald-200"
                    }`}
                  />
                  {validationErrors.name && (
                    <span className="text-xs text-red-600">{validationErrors.name}</span>
                  )}
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-emerald-900">Email</span>
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className={`rounded-md border px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    validationErrors.email
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-emerald-200"
                  }`}
                />
                {validationErrors.email && (
                  <span className="text-xs text-red-600">{validationErrors.email}</span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-900">Password</span>
                  {view === "sign-in" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setValidationErrors({});
                        router.push(withLocalePath(locale, "/auth/forgot-password"));
                      }}
                      className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className={`rounded-md border px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    validationErrors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-emerald-200"
                  }`}
                />
                {validationErrors.password && (
                  <span className="text-xs text-red-600">{validationErrors.password}</span>
                )}
              </label>

              {view === "sign-up" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-emerald-900">
                    Confirm password
                  </span>
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className={`rounded-md border px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                      validationErrors.confirmPassword
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-emerald-200"
                    }`}
                  />
                  {validationErrors.confirmPassword && (
                    <span className="text-xs text-red-600">
                      {validationErrors.confirmPassword}
                    </span>
                  )}
                </label>
              ) : null}

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400"
              >
                {isLoading
                  ? "Please wait..."
                  : view === "sign-in"
                  ? "Sign in"
                  : "Sign up"}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-emerald-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-emerald-600">or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              variant="outline"
              className="w-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>

            <p className="mt-4 text-center text-xs text-emerald-800/70">
              {view === "sign-in" ? (
                <>
                  Need an account?{" "}
                  <Button
                    type="button"
                    onClick={() => {
                      setView("sign-up");
                      setValidationErrors({});
                    }}
                    variant="link"
                    className="h-auto p-0 text-xs font-semibold text-emerald-800 underline-offset-2"
                  >
                    Sign up
                  </Button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Button
                    type="button"
                    onClick={() => {
                      setView("sign-in");
                      setValidationErrors({});
                    }}
                    variant="link"
                    className="h-auto p-0 text-xs font-semibold text-emerald-800 underline-offset-2"
                  >
                    Sign in
                  </Button>
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
