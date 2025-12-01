"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MapDetailModal } from "@/components/map/map-detail-modal";
import { X } from "lucide-react";
type DeliveryDictionary = typeof import("@/dictionaries/en/cart.json")["delivery"];

type DeliveryLocationPickerProps = {
  locations: DeliveryLocationOption[];
  selection: DeliverySelection | null;
  savedCustomSelection?: CustomDeliverySelection | null;
  dictionary: DeliveryDictionary;
  triggerLabel: string;
  triggerClassName?: string;
  onSelectionChange: (selection: DeliverySelection | null) => void;
};

// Session token generator for NEW Places API
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function DeliveryLocationPicker({
  locations,
  selection,
  savedCustomSelection = null,
  dictionary,
  triggerLabel,
  triggerClassName,
  onSelectionChange,
}: DeliveryLocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [locationId, setLocationId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [customCondo, setCustomCondo] = useState("");
  const [customBuilding, setCustomBuilding] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [customCoordinates, setCustomCoordinates] = useState<LatLngPoint | null>(null);
  const [shouldLoadMaps, setShouldLoadMaps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placePredictions, setPlacePredictions] = useState<Array<{
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text: string;
      secondary_text?: string;
    };
  }>>([]);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const placeSessionTokenRef = useRef<string | null>(null);
  const placeDetailsCacheRef = useRef<Map<string, LatLngPoint>>(new Map());
  const initialSelectionRef = useRef<DeliverySelection | null>(null);
  const displayedCustomSelection =
    selection?.mode === "custom"
      ? selection
      : savedCustomSelection ?? null;
  const hasDisplayCustom = Boolean(displayedCustomSelection?.customCondoName);

  const coordinatesEqual = (a: LatLngPoint | null | undefined, b: LatLngPoint | null | undefined) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.lat === b.lat && a.lng === b.lng;
  };

  const placeIdEqual = (a?: string | null, b?: string | null) => {
    return (a ?? "") === (b ?? "");
  };

  const ensureSessionToken = () => {
    if (!placeSessionTokenRef.current) {
      placeSessionTokenRef.current = generateSessionToken();
      if (process.env.NODE_ENV !== "production") {
        console.info("[places] session:start", { token: placeSessionTokenRef.current });
      }
    }
    return placeSessionTokenRef.current;
  };

  const resetSessionToken = () => {
    if (process.env.NODE_ENV !== "production" && placeSessionTokenRef.current) {
      console.info("[places] session:end", { token: placeSessionTokenRef.current });
    }
    placeSessionTokenRef.current = null;
  };

  // Fetch coordinates for selected place using FREE Place Details API
  const fetchPlaceCoordinates = useCallback(async (placeId: string) => {
    // Check cache first
    if (placeDetailsCacheRef.current.has(placeId)) {
      const coords = placeDetailsCacheRef.current.get(placeId)!;
      setCustomCoordinates(coords);
      setShouldLoadMaps(true);
      if (process.env.NODE_ENV !== "production") {
        console.info("[places] using cached coordinates");
      }
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
        if (process.env.NODE_ENV !== "production") {
          console.info("[places] fetched coordinates (FREE API)");
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to fetch place coordinates:", error);
      }
    }
  }, []);

  // Handle autocomplete prediction selection
  const handlePredictionSelect = useCallback((prediction: typeof placePredictions[0]) => {
    setCustomCondo(prediction.description);
    setPlacePredictions([]);
    
    if (prediction.place_id) {
      setSelectedPlaceId(prediction.place_id);
      void fetchPlaceCoordinates(prediction.place_id);
    }
  }, [fetchPlaceCoordinates]);

  // Clear address handler
  const handleClearAddress = useCallback(() => {
    setCustomCondo("");
    setCustomBuilding("");
    setSelectedPlaceId(null);
    setCustomCoordinates(null);
    setShouldLoadMaps(false);
    setPlacePredictions([]);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    initialSelectionRef.current = null;

    const customSource =
      selection?.mode === "custom"
        ? selection
        : savedCustomSelection ?? null;

    // Heavy caching: Load saved data immediately without API calls
    if (selection?.mode === "preset") {
      setMode("preset");
      setLocationId(selection.locationId);
      setBuildingId(selection.buildingId ?? "");
      setCustomCondo(customSource?.customCondoName ?? "");
      setCustomBuilding(customSource?.customBuildingName ?? "");
      setSelectedPlaceId(customSource?.placeId ?? null);
      setCustomCoordinates(customSource?.coordinates ?? null);

      if (customSource?.placeId && customSource.coordinates) {
        placeDetailsCacheRef.current.set(customSource.placeId, customSource.coordinates);
      }

      // Backfill coordinates for legacy custom selections with placeId but no coordinates.
      if (
        customSource?.placeId &&
        !customSource.coordinates &&
        !placeDetailsCacheRef.current.has(customSource.placeId)
      ) {
        void fetchPlaceCoordinates(customSource.placeId);
      }

      initialSelectionRef.current = {
        mode: "preset",
        locationId: selection.locationId,
        buildingId: selection.buildingId ?? null,
      };
      setShouldLoadMaps(Boolean(customSource?.coordinates));
    } else if (selection?.mode === "custom") {
      setMode("custom");
      setCustomCondo(selection.customCondoName);
      setCustomBuilding(selection.customBuildingName);
      setSelectedPlaceId(selection.placeId ?? null);
      setLocationId("");
      setBuildingId("");
      setCustomCoordinates(selection.coordinates ?? null);

      if (selection.placeId && selection.coordinates) {
        placeDetailsCacheRef.current.set(selection.placeId, selection.coordinates);
      }

      if (
        selection.placeId &&
        !selection.coordinates &&
        !placeDetailsCacheRef.current.has(selection.placeId)
      ) {
        void fetchPlaceCoordinates(selection.placeId);
      }

      setShouldLoadMaps(Boolean(selection.coordinates));
      initialSelectionRef.current = {
        mode: "custom",
        customCondoName: selection.customCondoName,
        customBuildingName: selection.customBuildingName,
        placeId: selection.placeId ?? undefined,
        coordinates: selection.coordinates ?? null,
      };
    } else if (savedCustomSelection) {
      setMode("preset");
      setLocationId("");
      setBuildingId("");
      setCustomCondo(savedCustomSelection.customCondoName);
      setCustomBuilding(savedCustomSelection.customBuildingName);
      setSelectedPlaceId(savedCustomSelection.placeId ?? null);
      setCustomCoordinates(savedCustomSelection.coordinates ?? null);

      if (savedCustomSelection.placeId && savedCustomSelection.coordinates) {
        placeDetailsCacheRef.current.set(
          savedCustomSelection.placeId,
          savedCustomSelection.coordinates
        );
      }

      if (
        savedCustomSelection.placeId &&
        !savedCustomSelection.coordinates &&
        !placeDetailsCacheRef.current.has(savedCustomSelection.placeId)
      ) {
        void fetchPlaceCoordinates(savedCustomSelection.placeId);
      }

      setShouldLoadMaps(Boolean(savedCustomSelection.coordinates));
      initialSelectionRef.current = {
        mode: "custom",
        customCondoName: savedCustomSelection.customCondoName,
        customBuildingName: savedCustomSelection.customBuildingName,
        placeId: savedCustomSelection.placeId ?? undefined,
        coordinates: savedCustomSelection.coordinates ?? null,
      };
    } else {
      setMode("preset");
      setLocationId("");
      setBuildingId("");
      setCustomCondo("");
      setCustomBuilding("");
      setSelectedPlaceId(null);
      setCustomCoordinates(null);
      setShouldLoadMaps(false);
    }
    setError(null);
    setPlacePredictions([]);
  }, [open, selection, savedCustomSelection, fetchPlaceCoordinates]);
  
  // Remove hasDisplayCustom from deps since we don't use it anymore

  const referenceSelection = useMemo(() => {
    if (mode === "preset") {
      return selection?.mode === "preset" ? selection : null;
    }
    if (selection?.mode === "custom") return selection;
    return savedCustomSelection ?? null;
  }, [mode, selection, savedCustomSelection]);

  const hasChanges = useMemo(() => {
    if (mode === "preset") {
      const refPreset = referenceSelection && referenceSelection.mode === "preset"
        ? referenceSelection
        : null;
      if (!refPreset) {
        return Boolean(locationId || buildingId);
      }
      return !(
        refPreset.locationId === locationId &&
        (refPreset.buildingId ?? null) === (buildingId || null)
      );
    }

    const refCustom = referenceSelection && referenceSelection.mode === "custom"
      ? referenceSelection
      : null;
    const trimmedName = customCondo.trim();
    const trimmedBuilding = customBuilding.trim();
    const coordsEqualOrPopulated =
      coordinatesEqual(refCustom?.coordinates, customCoordinates) ||
      (refCustom?.coordinates == null &&
        customCoordinates != null &&
        placeIdEqual(refCustom?.placeId, selectedPlaceId));

    if (!refCustom) {
      const initialCustom = initialSelectionRef.current && initialSelectionRef.current.mode === "custom"
        ? initialSelectionRef.current
        : null;
      const baseCompare = initialCustom ?? null;

      if (baseCompare) {
        const baseCoordsEqual =
          coordinatesEqual(baseCompare.coordinates, customCoordinates) ||
          (baseCompare.coordinates == null &&
            customCoordinates != null &&
            placeIdEqual(baseCompare.placeId, selectedPlaceId));
        return !(
          baseCompare.customCondoName === trimmedName &&
          (baseCompare.customBuildingName ?? "") === trimmedBuilding &&
          placeIdEqual(baseCompare.placeId, selectedPlaceId) &&
          baseCoordsEqual
        );
      }
      return Boolean(trimmedName || trimmedBuilding || selectedPlaceId || customCoordinates);
    }

    return !(
      refCustom.customCondoName === trimmedName &&
      (refCustom.customBuildingName ?? "") === trimmedBuilding &&
      placeIdEqual(refCustom.placeId, selectedPlaceId) &&
      coordsEqualOrPopulated
    );
  }, [
    mode,
    referenceSelection,
    locationId,
    buildingId,
    customCondo,
    customBuilding,
    selectedPlaceId,
    customCoordinates,
  ]);

  const actionLabel =
    hasChanges ? dictionary.modal.save : (dictionary.modal.useCurrent ?? "Use current selection");

  // Autocomplete with 350ms debounce (cost optimization)
  useEffect(() => {
    if (mode !== "custom") {
      setPlacePredictions([]);
      return;
    }

    const trimmedValue = customCondo.trim();
    
    // Minimum 3 characters
    if (trimmedValue.length < 3) {
      setPlacePredictions([]);
      return;
    }

    // Don't search if we already have this exact address selected
    if (selectedPlaceId && customCoordinates) {
      return;
    }

    let isCancelled = false;

    // 350ms debounce for cost optimization
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

        if (process.env.NODE_ENV !== "production") {
          console.info("[places] autocomplete", {
            input: trimmedValue,
            results: predictions.length,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Autocomplete error:", error);
        }
        if (!isCancelled) {
          setPlacePredictions([]);
        }
      }
    }, 350); // 350ms debounce

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [customCondo, mode, selectedPlaceId, customCoordinates]);

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

      // If nothing changed, just update selection locally and close
      if (!hasChanges) {
        onSelectionChange(payload);
        setOpen(false);
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/user/delivery-location", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "preset",
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
      placeId: selectedPlaceId ?? undefined, // Store place_id for FREE Place Details calls later
      coordinates: customCoordinates,
    };

    if (!hasChanges) {
      onSelectionChange(payload);
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/delivery-location", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "custom",
          customCondoName: payload.customCondoName,
          customBuildingName: payload.customBuildingName,
          placeId: payload.placeId ?? null,
          coordinates: customCoordinates,
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
      onSelectionChange(payload);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.errorGeneric;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={clsx(
              "rounded-full border-slate-200 text-xs font-semibold text-slate-700",
              triggerClassName
            )}
          >
            {triggerLabel}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
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
              aria-live="polite"
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
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                >
                  <SelectTrigger
                    className={clsx(
                      "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 min-h-14",
                      error ? "border-red-500" : "border-slate-200"
                    )}
                  >
                    <SelectValue placeholder={dictionary.modal.condoPlaceholder} />
                  </SelectTrigger>
                  <SelectContent
                    className="max-h-[60vh] sm:max-h-[50vh] w-(--radix-select-trigger-width)"
                    position="popper"
                    sideOffset={4}
                  >
                    {locations.map((location) => (
                      <SelectItem
                        key={location.id}
                        value={location.id}
                        textValue={`${location.condoName} (฿${location.minFee}–${location.maxFee})`}
                        className="py-3.5 px-3 text-sm min-h-16 cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                      >
                        <div className="flex flex-col gap-1 w-full pr-6">
                          <span className="font-medium text-slate-900 leading-tight">
                            {location.condoName}
                          </span>
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
                  <Select
                    value={buildingId}
                    onValueChange={setBuildingId}
                    disabled={!locationId}
                  >
                    <SelectTrigger className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 min-h-14 disabled:opacity-50 disabled:cursor-not-allowed">
                      <SelectValue placeholder={dictionary.modal.buildingPlaceholder} />
                    </SelectTrigger>
                    <SelectContent
                      className="max-h-[60vh] sm:max-h-[50vh] w-(--radix-select-trigger-width)"
                      position="popper"
                      sideOffset={4}
                    >
                      {activeLocation?.buildings.map((building) => (
                        <SelectItem
                          key={building.id}
                          value={building.id}
                          className="py-3.5 px-3 text-sm min-h-12 cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                        >
                          <span className="font-medium text-slate-900 leading-tight">
                            {building.label}
                          </span>
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
              {/* Search-first: Autocomplete input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  {dictionary.modal.customCondoLabel}
                </label>
                <div className="relative">
                  <Input
                    value={customCondo}
                    onChange={(e) => setCustomCondo(e.target.value)}
                    placeholder={dictionary.modal.customCondoPlaceholder}
                    className={clsx(
                      "pr-10",
                      error ? "border-red-500" : undefined
                    )}
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
                <p className="text-xs text-slate-500">
                  Type to search for your location (min 3 characters)
                </p>

                {/* Autocomplete suggestions */}
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

              {/* Validation map (appears after selection) */}
              {shouldLoadMaps && customCoordinates && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Location Preview
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <DeliveryLocationMap
                      coordinates={customCoordinates}
                      onMapClick={() => setIsMapModalOpen(true)}
                      className="h-48"
                    />
                  </div>
                </div>
              )}

              {/* Building/unit input */}
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
              {isSubmitting ? dictionary.modal.saving : actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map detail modal */}
      <MapDetailModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        coordinates={customCoordinates}
        addressName={customCondo}
      />
    </>
  );
}
