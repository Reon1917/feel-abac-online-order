"use client";

import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useUploadThing } from "@/lib/uploadthing";
import { compressImage } from "@/lib/image-compress";
import type { OrderPaymentType } from "@/lib/orders/types";
import { MAX_REJECTION_COUNT } from "@/config/payments";

type Props = {
  orderId: string;
  displayId: string;
  paymentType: OrderPaymentType;
  rejectionCount: number;
  dictionary: {
    uploadReceipt: string;
    uploading: string;
  };
  onSuccess?: () => void;
};

export function ReceiptUploadButton({
  orderId,
  displayId,
  paymentType,
  rejectionCount,
  dictionary,
  onSuccess,
}: Props) {
  const [isCompressing, setIsCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("paymentReceipt", {
    headers: {
      "x-order-id": orderId,
      "x-payment-type": paymentType,
    },
    onClientUploadComplete: async (res) => {
      if (!res?.[0]?.url) {
        toast.error("Upload failed");
        return;
      }

      try {
        const response = await fetch(`/api/orders/${displayId}/payment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: paymentType,
            receiptUrl: res[0].url,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update payment");
        }

        toast.success("Receipt uploaded successfully");
        onSuccess?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload receipt"
        );
      }
    },
    onUploadError: (error) => {
      toast.error(error.message || "Upload failed");
    },
  });

  const isBlocked = rejectionCount >= MAX_REJECTION_COUNT;
  const isProcessing = isCompressing || isUploading;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setIsCompressing(false);
      await startUpload([compressed]);
    } catch (error) {
      setIsCompressing(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to process image"
      );
    }
  };

  if (isBlocked) {
    return null; // RejectionBanner handles the blocked state UI
  }

  return (
    <label
      className={`
        w-full flex items-center justify-center gap-2 px-4 py-3 
        text-sm font-semibold rounded-xl transition-colors cursor-pointer
        ${
          isProcessing
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isProcessing}
      />
      {isProcessing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {dictionary.uploading}
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" />
          {dictionary.uploadReceipt}
        </>
      )}
    </label>
  );
}

