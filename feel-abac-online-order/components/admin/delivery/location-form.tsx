"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type AdminDeliveryDictionary = typeof import("@/dictionaries/en/admin-delivery.json");

type DeliveryLocationFormProps = {
  dictionary: AdminDeliveryDictionary["form"];
};

export function DeliveryLocationForm({ dictionary }: DeliveryLocationFormProps) {
  const router = useRouter();
  const [condoName, setCondoName] = useState("");
  const [minFee, setMinFee] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [notes, setNotes] = useState("");
  const [buildingText, setBuildingText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const minValue = Number(minFee);
    const maxValue = Number(maxFee);

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      setError("Enter a valid fee range.");
      return;
    }

    setIsSubmitting(true);

    try {
      const buildings = buildingText
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

      const response = await fetch("/api/admin/delivery-locations", {
        method: "POST",
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
        throw new Error(data?.error ?? dictionary.error);
      }

      toast.success(dictionary.success);
      setCondoName("");
      setMinFee("");
      setMaxFee("");
      setNotes("");
      setBuildingText("");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.error;
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.title}</h3>
        <p className="text-sm text-slate-600">{dictionary.description}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-slate-800">{dictionary.condoName}</span>
        <Input
          value={condoName}
          onChange={(event) => setCondoName(event.target.value)}
          required
          placeholder="ABAC Condo"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-800">{dictionary.minFee}</span>
          <Input
            type="number"
            min={0}
            value={minFee}
            onChange={(event) => setMinFee(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-800">{dictionary.maxFee}</span>
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
        <span className="font-semibold text-slate-800">{dictionary.notes}</span>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Driver meets at front gate"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-slate-800">{dictionary.buildings}</span>
        <Textarea
          value={buildingText}
          onChange={(event) => setBuildingText(event.target.value)}
          placeholder={dictionary.buildingsPlaceholder}
        />
        <span className="text-[11px] text-slate-500">{dictionary.buildingsHint}</span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="submit"
        className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
        disabled={isSubmitting}
      >
        {isSubmitting ? dictionary.submitting : dictionary.submit}
      </Button>
    </form>
  );
}
