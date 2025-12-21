"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { OnboardingPhone } from "@/components/onboarding/onboarding-phone";
import { OnboardingLocationPicker } from "@/components/onboarding/onboarding-location-picker";
import { completeOnboardingWithLocation } from "@/app/[lang]/onboarding/actions";
import type { DeliveryLocationOption, DeliverySelection } from "@/lib/delivery/types";
import { Button } from "@/components/ui/button";

type LocationStageState = { error?: string; ok?: boolean };

type OnboardingWizardProps = {
  userName?: string | null;
  userEmail?: string | null;
  defaultPhone?: string | null;
  deliveryLocations: DeliveryLocationOption[];
  deliveryDictionary: typeof import("@/dictionaries/en/cart.json")["delivery"];
};

export function OnboardingWizard({
  userName,
  userEmail,
  defaultPhone,
  deliveryLocations,
  deliveryDictionary,
}: OnboardingWizardProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [selection, setSelection] = useState<DeliverySelection | null>(null);
  const [locationState, locationAction, locationPending] = useActionState<LocationStageState, FormData>(
    completeOnboardingWithLocation,
    {}
  );

  useEffect(() => {
    if (locationState?.error) {
      toast.error(locationState.error);
    }
  }, [locationState?.error]);

  const selectionJson = useMemo(() => {
    return selection ? JSON.stringify(selection) : "";
  }, [selection]);

  const handleLocationSubmit = (formData: FormData) => {
    if (!selection) {
      toast.error(deliveryDictionary.errors.locationRequired);
      return;
    }
    formData.set("selection", selectionJson);
    locationAction(formData);
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 pb-6">
      {[0, 1, 2].map((idx) => (
        <span
          key={idx}
          className={
            "h-2 w-8 rounded-full transition " +
            (stage === idx ? "bg-emerald-600" : "bg-slate-200")
          }
        />
      ))}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {stepIndicator}

      {stage === 0 && (
        <OnboardingWelcome userName={userName ?? userEmail ?? ""} onStart={() => setStage(1)} />
      )}

      {stage === 1 && <OnboardingPhone defaultPhone={defaultPhone} onSuccess={() => setStage(2)} />}

      {stage === 2 && (
        <form action={handleLocationSubmit} className="flex flex-col gap-4">
          <OnboardingLocationPicker
            locations={deliveryLocations}
            initialSelection={selection}
            dictionary={deliveryDictionary}
            onSelectionConfirmed={setSelection}
          />
          <input type="hidden" name="selection" value={selectionJson} />
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage(1)}
              className="rounded-full"
              disabled={locationPending}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={locationPending}
            >
              {locationPending ? deliveryDictionary.modal.saving ?? "Saving..." : "Complete setup"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}






