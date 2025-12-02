"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "ghost",
}: {
  variant?: "ghost" | "solid" | "outline";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await fetch("/api/sign-out", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        toast.success("Signed out successfully");
        router.push("/");
        router.refresh();
      } catch (error) {
        console.error("Sign out failed", error);
        toast.error("Failed to sign out. Please try again.");
      }
    });
  };

  const buttonVariant =
    variant === "solid" ? "default" : variant === "outline" ? "outline" : "ghost";

  const buttonClass =
    variant === "solid"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : variant === "outline"
        ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        : "text-emerald-900 hover:bg-emerald-50";

  return (
    <Button
      onClick={handleSignOut}
      disabled={isPending}
      variant={buttonVariant}
      className={buttonClass}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
