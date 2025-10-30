"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AuthView = "sign-in" | "sign-up";

export function LoginModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("sign-in");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setIsOpen(false);
    setError(null);
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
    setError(null);

    const endpoint =
      view === "sign-in" ? "/api/sign-in" : "/api/sign-up";

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
        setError(
          data?.message ||
            "Something went wrong. Please try again."
        );
        setIsLoading(false);
        return;
      }

      close();
      router.push("/menu");
      router.refresh();
    } catch (err) {
      console.error("auth failed", err);
      setError("Unable to reach the server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-emerald-200 bg-white px-5 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
      >
        Log in / Sign up
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-950">
                {view === "sign-in" ? "Welcome back" : "Create an account"}
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 text-emerald-700 transition hover:bg-emerald-50"
                aria-label="Close login modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              {view === "sign-up" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-emerald-900">
                    Full name
                  </span>
                  <input
                    required
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className="rounded-md border border-emerald-200 px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-emerald-900">Email</span>
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="rounded-md border border-emerald-200 px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-emerald-900">Password</span>
                <input
                  required
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="••••••••"
                  className="rounded-md border border-emerald-200 px-3 py-2 text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>

              {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isLoading
                  ? "Please wait..."
                  : view === "sign-in"
                  ? "Sign in"
                  : "Sign up"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-emerald-800/70">
              {view === "sign-in" ? (
                <>
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => setView("sign-up")}
                    className="font-semibold text-emerald-800 underline underline-offset-2"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setView("sign-in")}
                    className="font-semibold text-emerald-800 underline underline-offset-2"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
