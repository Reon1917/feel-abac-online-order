"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "ghost",
}: {
  variant?: "ghost" | "solid";
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

  return (
    <Button
      onClick={handleSignOut}
      disabled={isPending}
      variant={variant === "solid" ? "default" : "ghost"}
      className={
        variant === "solid"
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "text-emerald-900 hover:bg-emerald-50"
      }
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
