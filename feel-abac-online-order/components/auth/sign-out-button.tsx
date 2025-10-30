"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SignOutButton({
  variant = "ghost",
}: {
  variant?: "ghost" | "solid";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await fetch("/api/sign-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      router.push("/");
      router.refresh();
    });
  };

  const baseClasses =
    "rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed";
  const variantClasses =
    variant === "solid"
      ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400"
      : "text-emerald-900 hover:bg-emerald-50";

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className={`${baseClasses} ${variantClasses}`}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
