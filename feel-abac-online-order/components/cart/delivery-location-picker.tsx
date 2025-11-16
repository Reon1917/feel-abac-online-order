"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  CustomDeliverySelection,
  DeliveryLocationOption,
  DeliverySelection,
  PresetDeliverySelection,
} from "@/lib/delivery/types";
type DeliveryDictionary = typeof import("@/dictionaries/en/cart.json")["delivery"];

type DeliveryLocationPickerProps = {
  locations: DeliveryLocationOption[];
  selection: DeliverySelection | null;
  dictionary: DeliveryDictionary;
  triggerLabel: string;
  onSelectionChange: (selection: DeliverySelection | null) => void;
};

export function DeliveryLocationPicker({
  locations,
  selection,
  dictionary,
  triggerLabel,
  onSelectionChange,
}: DeliveryLocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [locationId, setLocationId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [customCondo, setCustomCondo] = useState("");
  const [customBuilding, setCustomBuilding] = useState("");
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (selection?.mode === "preset") {
      setMode("preset");
      setLocationId(selection.locationId);
      setBuildingId(selection.buildingId ?? "");
      setCustomCondo("");
      setCustomBuilding("");
    } else if (selection?.mode === "custom") {
      setMode("custom");
      setCustomCondo(selection.customCondoName);
      setCustomBuilding(selection.customBuildingName);
      setLocationId("");
      setBuildingId("");
    } else {
      setMode("preset");
      setLocationId("");
      setBuildingId("");
      setCustomCondo("");
      setCustomBuilding("");
    }
    setRemember(false);
    setError(null);
  }, [open, selection]);

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === locationId) ?? null,
    [locations, locationId]
  );

  useEffect(() => {
    if (!activeLocation) {
      setBuildingId("");
      return;
    }

    const buildingExists = activeLocation.buildings.some(
      (building) => building.id === buildingId
    );

    if (!buildingExists) {
      setBuildingId("");
    }
  }, [activeLocation, buildingId]);

  const hasBuildings = (activeLocation?.buildings.length ?? 0) > 0;

  const handleSave = async () => {
    setError(null);

    if (mode === "preset") {
      if (!locationId) {
        setError(dictionary.errors.locationRequired);
        return;
      }

      const payload: PresetDeliverySelection = {
        mode: "preset",
        locationId,
        buildingId: buildingId || null,
      };

      setIsSubmitting(true);
      try {
        if (remember) {
          const response = await fetch("/api/user/delivery-location", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              locationId: payload.locationId,
              buildingId: payload.buildingId,
            }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            const message =
              data && typeof data.error === "string"
                ? data.error
                : dictionary.rememberError;
            throw new Error(message);
          }

          toast.success(dictionary.rememberSuccess);
        }

        onSelectionChange(payload);
        setOpen(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : dictionary.errorGeneric;
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedName = customCondo.trim();
    if (!trimmedName) {
      setError(dictionary.errors.customRequired);
      return;
    }

    const payload: CustomDeliverySelection = {
      mode: "custom",
      customCondoName: trimmedName,
      customBuildingName: customBuilding.trim(),
    };

    onSelectionChange(payload);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-slate-200 text-xs font-semibold text-slate-700"
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>{dictionary.modal.title}</DialogTitle>
          <DialogDescription>{dictionary.modal.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={clsx(
              "flex-1 rounded-full py-2 transition",
              mode === "preset"
                ? "bg-white text-slate-900 shadow-sm shadow-emerald-100"
                : "text-slate-500"
            )}
          >
            {dictionary.modal.savedTab}
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={clsx(
              "flex-1 rounded-full py-2 transition",
              mode === "custom"
                ? "bg-white text-slate-900 shadow-sm shadow-emerald-100"
                : "text-slate-500"
            )}
          >
            {dictionary.modal.customTab}
          </button>
        </div>

        {mode === "preset" ? (
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-slate-800">
                {dictionary.modal.condoLabel}
              </span>
              <select
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className={clsx(
                  "rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100",
                  error ? "border-red-500" : "border-slate-200"
                )}
              >
                <option value="">{dictionary.modal.condoPlaceholder}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.condoName} (฿{location.minFee}–{location.maxFee})
                  </option>
                ))}
              </select>
            </label>

            {hasBuildings ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-slate-800">
                  {dictionary.modal.buildingLabel}
                </span>
                <select
                  value={buildingId}
                  onChange={(event) => setBuildingId(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">{dictionary.modal.buildingPlaceholder}</option>
                  {activeLocation?.buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeLocation?.notes ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                {activeLocation.notes}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800">
                  {dictionary.rememberLabel}
                </p>
                <p className="text-[11px] text-slate-500">
                  {dictionary.rememberHint}
                </p>
              </div>
              <Switch
                disabled={isSubmitting}
                checked={remember}
                onCheckedChange={setRemember}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-slate-800">
                {dictionary.modal.customCondoLabel}
              </span>
              <Input
                value={customCondo}
                onChange={(event) => setCustomCondo(event.target.value)}
                placeholder={dictionary.modal.customCondoPlaceholder}
                className={clsx(error ? "border-red-500" : undefined)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-slate-800">
                {dictionary.modal.customBuildingLabel}
              </span>
              <Input
                value={customBuilding}
                onChange={(event) => setCustomBuilding(event.target.value)}
                placeholder={dictionary.modal.customBuildingPlaceholder}
              />
            </label>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              {dictionary.modal.customHelper}
            </p>
          </div>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            {dictionary.modal.cancel}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? dictionary.modal.saving : dictionary.modal.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
