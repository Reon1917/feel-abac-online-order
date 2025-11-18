"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BuildingFieldsSection } from "@/components/admin/delivery/building-fields";
import type { DeliveryLocationRecord } from "@/lib/delivery/types";

type AdminDeliveryDictionary = typeof import("@/dictionaries/en/admin-delivery.json");

type DeliveryLocationEditDialogProps = {
  location: DeliveryLocationRecord;
  dictionary: AdminDeliveryDictionary;
};

const INVALID_FEE_MESSAGE = "Enter a valid fee range.";

export function DeliveryLocationEditDialog({
  location,
  dictionary,
}: DeliveryLocationEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [condoName, setCondoName] = useState(location.condoName);
  const [minFee, setMinFee] = useState(String(location.minFee));
  const [maxFee, setMaxFee] = useState(String(location.maxFee));
  const [notes, setNotes] = useState(location.notes ?? "");
  const [hasBuildings, setHasBuildings] = useState(location.buildings.length > 0);
  const [buildingFields, setBuildingFields] = useState<string[]>(
    location.buildings.length > 0 ? location.buildings.map((building) => building.label) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCondoName(location.condoName);
    setMinFee(String(location.minFee));
    setMaxFee(String(location.maxFee));
    setNotes(location.notes ?? "");
    setHasBuildings(location.buildings.length > 0);
    setBuildingFields(
      location.buildings.length > 0
        ? location.buildings.map((building) => building.label)
        : []
    );
    setError(null);
  }, [open, location]);

  const handleToggleBuildings = (checked: boolean) => {
    setHasBuildings(checked);
    if (checked && buildingFields.length === 0) {
      setBuildingFields([""]);
    }
    if (!checked) {
      setBuildingFields([]);
    }
  };

  const handleBuildingChange = (index: number, value: string) => {
    setBuildingFields((prev) => prev.map((entry, idx) => (idx === index ? value : entry)));
  };

  const handleAddBuildingField = () => {
    setBuildingFields((prev) => [...prev, ""]);
  };

  const handleRemoveBuildingField = (index: number) => {
    setBuildingFields((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length === 0 ? [""] : next;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    const minValue = Number(minFee);
    const maxValue = Number(maxFee);

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      setError(INVALID_FEE_MESSAGE);
      return;
    }

    if (minValue > maxValue) {
      setError(dictionary.form.invalidFeeOrder);
      return;
    }

    const buildings = hasBuildings
      ? buildingFields.map((entry) => entry.trim()).filter(Boolean)
      : [];

    if (hasBuildings && buildings.length === 0) {
      setError(dictionary.form.buildingsEmpty);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/delivery-locations/${location.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          condoName,
          minFee: minValue,
          maxFee: maxValue,
          notes,
          buildings,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? dictionary.edit.error);
      }

      toast.success(dictionary.edit.success);
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.edit.error;
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-slate-200 text-xs font-semibold text-slate-700"
        >
          {dictionary.list.editButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>{dictionary.edit.title}</DialogTitle>
          <DialogDescription>{dictionary.edit.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-800">{dictionary.form.condoName}</span>
            <Input
              value={condoName}
              onChange={(event) => setCondoName(event.target.value)}
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-slate-800">{dictionary.form.minFee}</span>
              <Input
                type="number"
                min={0}
                value={minFee}
                onChange={(event) => setMinFee(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-slate-800">{dictionary.form.maxFee}</span>
              <Input
                type="number"
                min={0}
                value={maxFee}
                onChange={(event) => setMaxFee(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-800">{dictionary.form.notes}</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Driver meets at front gate"
            />
          </label>

          <BuildingFieldsSection
            dictionary={dictionary.form}
            hasBuildings={hasBuildings}
            onHasBuildingsChange={handleToggleBuildings}
            buildingFields={buildingFields}
            onBuildingChange={handleBuildingChange}
            onAddBuilding={handleAddBuildingField}
            onRemoveBuilding={handleRemoveBuildingField}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {dictionary.edit.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={isSubmitting}
          >
            {isSubmitting ? dictionary.edit.submitting : dictionary.edit.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
