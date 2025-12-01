"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliveryLocationMap } from "@/components/map/delivery-location-map";
import type { LatLngPoint } from "@/lib/delivery/location-coordinates";

type MapDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  coordinates: LatLngPoint | null;
  addressName: string;
};

export function MapDetailModal({
  isOpen,
  onClose,
  coordinates,
  addressName,
}: MapDetailModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="relative flex w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Location map detail"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-slate-900">
                {addressName || "Location Preview"}
              </h2>
              <p className="text-sm text-slate-500">Delivery location map</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0 rounded-full"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Map */}
          <div className="h-[70vh] min-h-[400px] w-full overflow-hidden">
            <DeliveryLocationMap
              coordinates={coordinates}
              className="h-full rounded-b-3xl border-0"
            />
          </div>
        </div>
      </div>
    </>
  );
}

