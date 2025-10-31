"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { onboardingSchema } from "@/lib/validations";

interface PhoneEditModalProps {
  currentPhone: string;
  onUpdate?: () => void;
}

export function PhoneEditModal({ currentPhone, onUpdate }: PhoneEditModalProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(currentPhone);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPhoneNumber(currentPhone);
      setError(null);
    }
  }, [open, currentPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If phone hasn't changed, just close the modal
    if (phoneNumber === currentPhone) {
      setOpen(false);
      return;
    }

    const parsed = onboardingSchema.safeParse({ phoneNumber });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid phone number");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/user/phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: parsed.data.phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update phone number");
      }

      toast.success("Phone number updated successfully");
      setOpen(false);
      
      // Force page reload to show updated phone number
      window.location.reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update phone number";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full hover:bg-emerald-50"
          aria-label="Edit phone number"
        >
          <Pencil className="size-3.5 text-slate-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update phone number</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-800">Phone number</span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0812345678 or +66812345678"
              className={`rounded-md border bg-white px-3 py-2 text-slate-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-200"
              }`}
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

