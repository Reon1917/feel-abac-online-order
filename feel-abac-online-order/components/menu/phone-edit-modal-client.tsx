"use client";

import dynamic from "next/dynamic";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

const LazyPhoneEditModal = dynamic(() =>
  import("./phone-edit-modal").then((mod) => ({
    default: mod.PhoneEditModal,
  })),
  {
    ssr: false,
    loading: () => (
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full opacity-60"
        aria-hidden="true"
        tabIndex={-1}
      >
        <Pencil className="size-3.5 text-slate-300" />
      </Button>
    ),
  }
);

export function PhoneEditModalClient({
  currentPhone,
}: {
  currentPhone: string;
}) {
  return <LazyPhoneEditModal currentPhone={currentPhone} />;
}
