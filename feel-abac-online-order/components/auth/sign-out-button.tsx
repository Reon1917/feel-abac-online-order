"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({
  variant = "ghost",
  size = "default",
  className,
  children,
  ariaLabel,
}: {
  variant?: "ghost" | "solid" | "outline";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
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
        if (process.env.NODE_ENV !== "production") {
          console.error("Sign out failed", error);
        }
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

  const content = children ?? (isPending ? "Signing out..." : "Sign out");

  return (
    <Button
      onClick={handleSignOut}
      disabled={isPending}
      variant={buttonVariant}
      size={size}
      className={cn(buttonClass, className)}
      aria-label={ariaLabel}
    >
      {content}
    </Button>
  );
}
