"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import {
  getLocationCoordinates,
  type LatLngPoint,
} from "@/lib/delivery/location-coordinates";
import { useGoogleMapsLoader } from "@/lib/map/use-google-maps-loader";
type DeliveryDictionary = typeof import("@/dictionaries/en/cart.json")["delivery"];

type DeliveryLocationPickerProps = {
  locations: DeliveryLocationOption[];
  selection: DeliverySelection | null;
  dictionary: DeliveryDictionary;
  triggerLabel: string;
  triggerClassName?: string;
  onSelectionChange: (selection: DeliverySelection | null) => void;
};

function GoogleMapsLoaderGate({
  onStatus,
}: {
  onStatus: (isLoaded: boolean, loadError: Error | null) => void;
}) {
  const { isLoaded, loadError } = useGoogleMapsLoader();

  useEffect(() => {
    onStatus(isLoaded, (loadError as Error | null) ?? null);
  }, [isLoaded, loadError, onStatus]);

  return null;
}

export function DeliveryLocationPicker({
  locations,
  selection,
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
  const [customCoordinates, setCustomCoordinates] = useState<LatLngPoint | null>(null);
  const [presetCoordinates, setPresetCoordinates] = useState<LatLngPoint | null>(null);
  const [showPresetMap, setShowPresetMap] = useState(false);
  const [showCustomMap, setShowCustomMap] = useState(false);
  const [lastAutocompleteValue, setLastAutocompleteValue] = useState<string | null>(null);
  const [shouldLoadMaps, setShouldLoadMaps] = useState(false);
  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false);
  const [, setMapsLoadError] = useState<Error | null>(null);
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placePredictions, setPlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const placeSessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placeDetailsCacheRef = useRef<Map<string, LatLngPoint>>(new Map());
  const findPlaceCacheRef = useRef<Map<string, LatLngPoint>>(new Map());
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const canUsePlacesAutocomplete = Boolean(mapsApiKey) && isMapsApiLoaded;
  const handleMapsStatus = useCallback(
    (loaded: boolean, loadError: Error | null) => {
      setIsMapsApiLoaded(loaded);
      setMapsLoadError(loadError);
      if (loadError && process.env.NODE_ENV !== "production") {
        console.warn("Google Maps failed to load:", loadError);
      }
      if (!mapsApiKey && process.env.NODE_ENV !== "production") {
        console.warn("Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable map and places preview.");
      }
    },
    [mapsApiKey]
  );

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
    setCustomCoordinates(null);
    setPresetCoordinates(null);
    setShowPresetMap(false);
    setShowCustomMap(false);
    setShouldLoadMaps(false);
    setIsMapsApiLoaded(false);
    setMapsLoadError(null);
    setLastAutocompleteValue(null);
  }, [open, selection]);

  useEffect(() => {
    if (mode === "preset") {
      setCustomCoordinates(null);
      setLastAutocompleteValue(null);
      setPlacePredictions([]);
    }
  }, [mode]);

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

  useEffect(() => {
    let isCancelled = false;

    if (!activeLocation) {
      setPresetCoordinates(null);
      return;
    }

    const staticCoordinates = getLocationCoordinates(activeLocation);
    if (staticCoordinates) {
      setPresetCoordinates(staticCoordinates);
      return;
    }

    if (!showPresetMap || !canUsePlacesAutocomplete) {
      setPresetCoordinates(null);
      return;
    }

    const queryParts = [activeLocation.condoName, activeLocation.area]
      .filter(Boolean)
      .join(" ");

    const cached = findPlaceCacheRef.current.get(queryParts);
    if (cached) {
      setPresetCoordinates(cached);
      return;
    }

    const service = ensurePlacesService();
    if (!service) {
      setPresetCoordinates(null);
      return;
    }

    service.findPlaceFromQuery(
      {
        query: queryParts,
        fields: ["geometry"],
        sessionToken: ensureSessionToken(),
      },
      (results, status) => {
        if (isCancelled) {
          return;
        }

        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          results &&
          results[0]?.geometry?.location
        ) {
          const coords = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          };
          setPresetCoordinates(coords);
          findPlaceCacheRef.current.set(queryParts, coords);
        } else {
          setPresetCoordinates(null);
        }
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [activeLocation, canUsePlacesAutocomplete, showPresetMap]);

  const ensureAutocompleteService = () => {
    if (!autocompleteServiceRef.current) {
      if (typeof window !== "undefined" && google?.maps?.places?.AutocompleteService) {
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      }
    }
    return autocompleteServiceRef.current;
  };

  const ensurePlacesService = () => {
    if (!placesServiceRef.current) {
      const dummy = typeof window !== "undefined" ? document.createElement("div") : null;
      if (dummy) {
        placesServiceRef.current = new google.maps.places.PlacesService(dummy);
      }
    }
    return placesServiceRef.current;
  };

  const ensureSessionToken = () => {
    if (!placeSessionTokenRef.current && typeof window !== "undefined" && google?.maps?.places?.AutocompleteSessionToken) {
      placeSessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    return placeSessionTokenRef.current ?? undefined;
  };

  const resetSessionToken = () => {
    placeSessionTokenRef.current = null;
  };

  const fetchPlaceGeometry = (placeId: string) => {
    if (placeDetailsCacheRef.current.has(placeId)) {
      setCustomCoordinates(placeDetailsCacheRef.current.get(placeId) ?? null);
      return;
    }

    const service = ensurePlacesService();
    if (!service) {
      setCustomCoordinates(null);
      return;
    }

    service.getDetails(
      {
        placeId,
        fields: ["geometry", "name", "formatted_address"],
        sessionToken: ensureSessionToken(),
      },
      (result, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          result?.geometry?.location
        ) {
          const coords = {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
          };
          setCustomCoordinates(coords);
          placeDetailsCacheRef.current.set(placeId, coords);
          if (!lastAutocompleteValue && result.name) {
            setLastAutocompleteValue(result.name);
          }
          resetSessionToken();
        } else {
          setCustomCoordinates(null);
        }
      }
    );
  };

  const handlePredictionSelect = (
    prediction: google.maps.places.AutocompletePrediction
  ) => {
    const description =
      prediction.description ??
      prediction.structured_formatting?.main_text ??
      customCondo;

    setCustomCondo(description);
    setLastAutocompleteValue(description);
    setPlacePredictions([]);
    setShouldLoadMaps(true);

    if (prediction.place_id) {
      fetchPlaceGeometry(prediction.place_id);
    } else {
      setCustomCoordinates(null);
    }
  };

  const handleCustomCondoChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value;
    setCustomCondo(nextValue);
    setShouldLoadMaps(true);
    if (nextValue !== lastAutocompleteValue) {
      setCustomCoordinates(null);
      setLastAutocompleteValue(null);
    }
  };

  useEffect(() => {
    if (!shouldLoadMaps || !canUsePlacesAutocomplete) {
      setPlacePredictions([]);
      return;
    }

    const trimmedValue = customCondo.trim();
    if (!trimmedValue || trimmedValue === lastAutocompleteValue) {
      setPlacePredictions([]);
      return;
    }

    const service = ensureAutocompleteService();
    if (!service) {
      setPlacePredictions([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      service.getPlacePredictions(
        {
          input: trimmedValue,
          types: ["geocode", "establishment"],
        },
        (results, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            results
          ) {
            setPlacePredictions(results.slice(0, 5));
          } else {
            setPlacePredictions([]);
          }
        }
      );
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [customCondo, lastAutocompleteValue, canUsePlacesAutocomplete, shouldLoadMaps]);

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
        {shouldLoadMaps ? (
          <GoogleMapsLoaderGate onStatus={handleMapsStatus} />
        ) : null}

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
            {showPresetMap ? (
              <DeliveryLocationMap
                location={activeLocation}
                coordinates={presetCoordinates}
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {dictionary.modal.mapPreviewTitle ?? "Map preview"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {dictionary.modal.mapPreviewHelper ?? "Tap to load Google Maps for this location."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowPresetMap(true);
                    setShouldLoadMaps(true);
                  }}
                >
                  {dictionary.modal.mapPreviewAction ?? "Show map"}
                </Button>
              </div>
            )}

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
                onChange={handleCustomCondoChange}
                placeholder={dictionary.modal.customCondoPlaceholder}
                className={clsx(error ? "border-red-500" : undefined)}
                autoComplete="off"
                onFocus={() => setShouldLoadMaps(true)}
              />
              <p className="text-[11px] text-slate-500">
                Smart location suggestions appear as you type; map preview stays optional.
              </p>
              {canUsePlacesAutocomplete && placePredictions.length > 0 ? (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {placePredictions.map((prediction) => (
                      <li key={prediction.place_id ?? prediction.description}>
                        <button
                          type="button"
                          onClick={() => handlePredictionSelect(prediction)}
                          className="w-full px-4 py-2 text-left hover:bg-emerald-50 focus:bg-emerald-50"
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {prediction.structured_formatting?.main_text ?? prediction.description}
                          </p>
                          {prediction.structured_formatting?.secondary_text ? (
                            <p className="text-xs text-slate-500">
                              {prediction.structured_formatting.secondary_text}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="px-4 pb-2 text-right text-[10px] uppercase tracking-wide text-slate-400">
                    Smart location search
                  </p>
                </div>
              ) : null}
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
            {showCustomMap ? (
              <DeliveryLocationMap
                location={null}
                coordinates={customCoordinates}
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {dictionary.modal.mapPreviewTitle ?? "Map preview"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {dictionary.modal.mapPreviewHelper ?? "Tap to load Google Maps for this location."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCustomMap(true);
                    setShouldLoadMaps(true);
                  }}
                >
                  {dictionary.modal.mapPreviewAction ?? "Show map"}
                </Button>
              </div>
            )}
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
