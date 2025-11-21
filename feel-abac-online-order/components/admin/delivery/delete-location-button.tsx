"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AdminDeliveryDictionary = typeof import("@/dictionaries/en/admin-delivery.json");

type DeleteLocationButtonProps = {
  locationId: string;
  dictionary: AdminDeliveryDictionary;
};

export function DeleteLocationButton({ locationId, dictionary }: DeleteLocationButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const listCopy = dictionary.list;
  const cancelLabel = dictionary.edit.cancel ?? "Cancel";
  const confirmTitle = listCopy.deleteConfirmTitle ?? listCopy.deleteButton ?? "Delete location";
  const confirmDescription = listCopy.deleteConfirm ?? "Delete this delivery location?";

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/delivery-locations/${locationId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? listCopy.deleteError ?? "Unable to delete delivery location");
      }

      toast.success(listCopy.deleteSuccess ?? "Delivery location removed");
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : listCopy.deleteError ?? "Unable to delete delivery location";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {listCopy.deleteButton ?? "Delete"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm space-y-4">
        <DialogHeader>
          <DialogTitle className="text-red-600">{confirmTitle}</DialogTitle>
          <DialogDescription>{confirmDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-500"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? listCopy.deletePending ?? "Deleting..." : listCopy.deleteButton ?? "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
