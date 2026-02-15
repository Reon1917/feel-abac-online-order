"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { X } from "lucide-react";
import { DeliveryLocationMap } from "@/components/map/delivery-location-map";
import type {
  CustomDeliverySelection,
  DeliveryLocationOption,
  DeliverySelection,
  PresetDeliverySelection,
} from "@/lib/delivery/types";
import { getUniversityAreaRectangle, type LatLngPoint } from "@/lib/delivery/location-coordinates";
import {
  autocompleteNew,
  placeDetailsIdsOnly,
  convertToSdkPrediction,
} from "@/lib/map/places-api-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type DeliveryDictionary = typeof import("@/dictionaries/en/cart.json")["delivery"];

type OnboardingLocationPickerProps = {
  locations: DeliveryLocationOption[];
  initialSelection: DeliverySelection | null;
  savedCustomSelection?: CustomDeliverySelection | null;
  dictionary: DeliveryDictionary;
  onSelectionConfirmed: (selection: DeliverySelection) => void;
};

// Session token generator for NEW Places API
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function OnboardingLocationPicker({
  locations,
  initialSelection,
  savedCustomSelection = null,
  dictionary,
  onSelectionConfirmed,
}: OnboardingLocationPickerProps) {
  const [mode, setMode] = useState<"preset" | "custom">(initialSelection?.mode ?? "preset");
  const [locationId, setLocationId] = useState(
    initialSelection?.mode === "preset" ? initialSelection.locationId : ""
  );
  const [buildingId, setBuildingId] = useState(
    initialSelection?.mode === "preset" ? initialSelection.buildingId ?? "" : ""
  );
  const [customCondo, setCustomCondo] = useState(
    initialSelection?.mode === "custom"
      ? initialSelection.customCondoName
      : savedCustomSelection?.customCondoName ?? ""
  );
  const [customBuilding, setCustomBuilding] = useState(
    initialSelection?.mode === "custom"
      ? initialSelection.customBuildingName ?? ""
      : savedCustomSelection?.customBuildingName ?? ""
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    initialSelection?.mode === "custom"
      ? initialSelection.placeId ?? null
      : savedCustomSelection?.placeId ?? null
  );
  const [customCoordinates, setCustomCoordinates] = useState<LatLngPoint | null>(
    initialSelection?.mode === "custom"
      ? initialSelection.coordinates ?? null
      : savedCustomSelection?.coordinates ?? null
  );
  const [shouldLoadMaps, setShouldLoadMaps] = useState(Boolean(customCoordinates));
  const [error, setError] = useState<string | null>(null);
  const [placePredictions, setPlacePredictions] = useState<
    Array<{
      place_id: string;
      description: string;
      structured_formatting?: { main_text: string; secondary_text?: string };
    }>
  >([]);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const placeSessionTokenRef = useRef<string | null>(null);
  const placeDetailsCacheRef = useRef<Map<string, LatLngPoint>>(new Map());

  const ensureSessionToken = () => {
    if (!placeSessionTokenRef.current) {
      placeSessionTokenRef.current = generateSessionToken();
    }
    return placeSessionTokenRef.current;
  };

  const resetSessionToken = () => {
    placeSessionTokenRef.current = null;
  };

  // Fetch coordinates for selected place using FREE Place Details API
  const fetchPlaceCoordinates = useCallback(
    async (placeId: string) => {
      if (placeDetailsCacheRef.current.has(placeId)) {
        const coords = placeDetailsCacheRef.current.get(placeId)!;
        setCustomCoordinates(coords);
        setShouldLoadMaps(true);
        return;
      }

      try {
        const result = await placeDetailsIdsOnly(placeId);
        if (result?.location) {
          const coords = {
            lat: result.location.latitude,
            lng: result.location.longitude,
          };
          setCustomCoordinates(coords);
          placeDetailsCacheRef.current.set(placeId, coords);
          setShouldLoadMaps(true);
          resetSessionToken();
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const handlePredictionSelect = useCallback(
    (prediction: (typeof placePredictions)[0]) => {
      setCustomCondo(prediction.description);
      setPlacePredictions([]);

      if (prediction.place_id) {
        setSelectedPlaceId(prediction.place_id);
        void fetchPlaceCoordinates(prediction.place_id);
      }
    },
    [fetchPlaceCoordinates]
  );

  const handleClearAddress = useCallback(() => {
    setCustomCondo("");
    setCustomBuilding("");
    setSelectedPlaceId(null);
    setCustomCoordinates(null);
    setShouldLoadMaps(false);
    setPlacePredictions([]);
  }, []);

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === locationId) ?? null,
    [locations, locationId]
  );

  useEffect(() => {
    if (!activeLocation) {
      setBuildingId("");
      return;
    }

    const buildingExists = activeLocation.buildings.some((building) => building.id === buildingId);
    if (!buildingExists) {
      setBuildingId("");
    }
  }, [activeLocation, buildingId]);

  const hasBuildings = (activeLocation?.buildings.length ?? 0) > 0;

  // Autocomplete with debounce
  useEffect(() => {
    if (mode !== "custom") {
      setPlacePredictions([]);
      return;
    }

    const trimmedValue = customCondo.trim();
    if (trimmedValue.length < 3) {
      setPlacePredictions([]);
      return;
    }

    if (selectedPlaceId && customCoordinates) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const sessionToken = ensureSessionToken();
        const locationRestriction = getUniversityAreaRectangle();

        const response = await autocompleteNew({
          input: trimmedValue,
          locationRestriction: locationRestriction ?? undefined,
          sessionToken,
          languageCode: "en",
        });

        if (isCancelled) return;

        const predictions = response.suggestions
          .filter((s) => s.placePrediction)
          .map((s) => convertToSdkPrediction(s.placePrediction!))
          .slice(0, 5);

        setPlacePredictions(predictions);
      } catch {
        if (!isCancelled) {
          setPlacePredictions([]);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [customCondo, mode, selectedPlaceId, customCoordinates]);

  const buildSelection = useCallback((): { selection: DeliverySelection | null; error?: string } => {
    if (mode === "preset") {
      if (!locationId) {
        return { selection: null, error: dictionary.errors.locationRequired };
      }
      const payload: PresetDeliverySelection = {
        mode: "preset",
        locationId,
        buildingId: buildingId || null,
      };
      return { selection: payload };
    }

    const trimmedName = customCondo.trim();
    if (!trimmedName) {
      return { selection: null, error: dictionary.errors.customRequired };
    }

    const payload: CustomDeliverySelection = {
      mode: "custom",
      customCondoName: trimmedName,
      customBuildingName: customBuilding.trim(),
      placeId: selectedPlaceId ?? undefined,
      coordinates: customCoordinates,
    };

    return { selection: payload };
  }, [
    mode,
    locationId,
    buildingId,
    customCondo,
    customBuilding,
    selectedPlaceId,
    customCoordinates,
    dictionary.errors.locationRequired,
    dictionary.errors.customRequired,
  ]);

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const { selection, error: selectionError } = buildSelection();
      if (selectionError || !selection) {
        setError(selectionError ?? dictionary.errorGeneric);
        return;
      }

      onSelectionConfirmed(selection);
      toast.success(dictionary.rememberSuccess);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to confirm onboarding delivery selection", error);
      }
      setError(dictionary.errorGeneric);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectionSummary = useMemo(() => {
    if (mode === "preset") {
      const loc = locations.find((l) => l.id === locationId);
      if (!loc) return dictionary.notSelected;
      if (buildingId) {
        const building = loc.buildings.find((b) => b.id === buildingId);
        return building ? `${loc.condoName} · ${building.label}` : loc.condoName;
      }
      return loc.condoName;
    }
    if (!customCondo.trim()) return dictionary.notSelected;
    return customBuilding.trim()
      ? `${customCondo.trim()} · ${customBuilding.trim()}`
      : customCondo.trim();
  }, [mode, locations, locationId, buildingId, customCondo, customBuilding, dictionary.notSelected]);

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-slate-100 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Step 3 of 3
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Choose your delivery spot
          </h2>
          <p className="text-sm text-slate-600">
            {dictionary.modal.subtitle ?? "Set a default address to speed up checkout."}
          </p>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {selectionSummary}
        </div>
      </div>

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
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800">
              {dictionary.modal.condoLabel}
            </label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger
                className={clsx(
                  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 min-h-14",
                  error ? "border-red-500" : "border-slate-200"
                )}
              >
                <SelectValue placeholder={dictionary.modal.condoPlaceholder} />
              </SelectTrigger>
              <SelectContent
                className="w-(--radix-select-trigger-width) max-h-[40svh] sm:max-h-[50vh] overscroll-contain"
                position="popper"
                side="bottom"
                align="start"
                sideOffset={6}
                avoidCollisions={false}
              >
                {locations.map((location) => (
                  <SelectItem
                    key={location.id}
                    value={location.id}
                    textValue={`${location.condoName} (฿${location.minFee}–${location.maxFee})`}
                    className="py-3.5 px-3 text-sm min-h-16 cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                  >
                    <div className="flex flex-col gap-1 w-full pr-6">
                      <span className="font-medium text-slate-900 leading-tight">{location.condoName}</span>
                      <span className="text-xs text-slate-500">
                        ฿{location.minFee}–{location.maxFee}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasBuildings ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">
                {dictionary.modal.buildingLabel}
              </label>
              <Select value={buildingId} onValueChange={setBuildingId} disabled={!locationId}>
                <SelectTrigger className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 min-h-14 disabled:opacity-50 disabled:cursor-not-allowed">
                  <SelectValue placeholder={dictionary.modal.buildingPlaceholder} />
                </SelectTrigger>
                <SelectContent
                  className="w-(--radix-select-trigger-width) max-h-[40svh] sm:max-h-[50vh] overscroll-contain"
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  {activeLocation?.buildings.map((building) => (
                    <SelectItem
                      key={building.id}
                      value={building.id}
                      className="py-3.5 px-3 text-sm min-h-12 cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                    >
                      <span className="font-medium text-slate-900 leading-tight">{building.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {activeLocation?.notes ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              {activeLocation.notes}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              {dictionary.modal.customCondoLabel}
            </label>
            <div className="relative">
              <Input
                value={customCondo}
                onChange={(e) => setCustomCondo(e.target.value)}
                placeholder={dictionary.modal.customCondoPlaceholder}
                className={clsx("pr-10", error ? "border-red-500" : undefined)}
                autoComplete="off"
              />
              {customCondo && (
                <button
                  type="button"
                  onClick={handleClearAddress}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear address"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Type to search for your location (min 3 characters)</p>

            {placePredictions.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <ul className="max-h-60 overflow-y-auto py-1">
                  {placePredictions.map((prediction) => (
                    <li key={prediction.place_id}>
                      <button
                        type="button"
                        onClick={() => handlePredictionSelect(prediction)}
                        className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 focus:bg-emerald-50"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {prediction.structured_formatting?.main_text ?? prediction.description}
                        </p>
                        {prediction.structured_formatting?.secondary_text && (
                          <p className="text-xs text-slate-500">
                            {prediction.structured_formatting.secondary_text}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {shouldLoadMaps && customCoordinates && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Location Preview</p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <DeliveryLocationMap
                  coordinates={customCoordinates}
                  onMapClick={() => setIsMapModalOpen(true)}
                  className="h-48"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              {dictionary.modal.customBuildingLabel}
            </label>
            <Input
              value={customBuilding}
              onChange={(e) => setCustomBuilding(e.target.value)}
              placeholder={dictionary.modal.customBuildingPlaceholder ?? "Building/Unit (optional)"}
            />
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? dictionary.modal.saving ?? "Saving..." : dictionary.modal.save ?? "Use this location"}
        </Button>
      </div>

      {isMapModalOpen && customCoordinates ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2">
              <div className="text-sm font-semibold text-slate-800">Confirm location</div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200">
              <DeliveryLocationMap coordinates={customCoordinates} className="h-[60vh]" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
