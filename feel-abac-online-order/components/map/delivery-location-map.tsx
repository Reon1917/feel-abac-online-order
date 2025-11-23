"use client";

import { useMemo } from "react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";

import type { DeliveryLocationOption } from "@/lib/delivery/types";
import {
  DEFAULT_LOCATION_COORDINATE,
  getLocationCoordinates,
  type LatLngPoint,
} from "@/lib/delivery/location-coordinates";
import { useGoogleMapsLoader } from "@/lib/map/use-google-maps-loader";
import { cn } from "@/lib/utils";

type DeliveryLocationMapProps = {
  location?: DeliveryLocationOption | null;
  coordinates?: LatLngPoint | null;
  className?: string;
};

const PLACEHOLDER_LABELS = {
  unavailable: "Map preview unavailable.",
  loading: "Loading map preview.",
  selectLocation: "Select a delivery location to preview the map.",
};

function MapPlaceholder({
  label = PLACEHOLDER_LABELS.unavailable,
  tone = "default",
}: {
  label?: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        tone === "error" ? "bg-slate-100" : "bg-transparent"
      )}
      role="img"
      aria-label={label}
    >
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top,#ffffff,#e2e8f0)]" />
      <div className="absolute inset-4 rounded-2xl border border-white/60" />
    </div>
  );
}

export function DeliveryLocationMap({
  location = null,
  coordinates = null,
  className,
}: DeliveryLocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const resolvedCoordinates = useMemo(() => {
    if (coordinates) {
      return coordinates;
    }
    return getLocationCoordinates(location ?? null);
  }, [coordinates, location]);

  const { isLoaded, loadError } = useGoogleMapsLoader();

  const center = resolvedCoordinates ?? DEFAULT_LOCATION_COORDINATE;
  const shouldShowMarker = Boolean(resolvedCoordinates);
  const hasSelection = Boolean(location) || Boolean(coordinates);

  const containerClassName = cn(
    "h-48 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100",
    className
  );

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable the delivery map preview.");
    }
    return (
      <div className={containerClassName}>
        <MapPlaceholder label={PLACEHOLDER_LABELS.unavailable} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={containerClassName}>
        <MapPlaceholder label={PLACEHOLDER_LABELS.unavailable} tone="error" />
      </div>
    );
  }

  if (!hasSelection) {
    return (
      <div className={containerClassName}>
        <MapPlaceholder label={PLACEHOLDER_LABELS.selectLocation} />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={containerClassName}>
        <MapPlaceholder label={PLACEHOLDER_LABELS.loading} />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <div className="relative h-full w-full">
        <GoogleMap
          center={center}
          zoom={shouldShowMarker ? 16 : 13}
          options={{
            disableDefaultUI: true,
            clickableIcons: false,
            draggable: true,
            gestureHandling: "greedy",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
          mapContainerStyle={{ height: "100%", width: "100%" }}
        >
          {shouldShowMarker ? <MarkerF position={center} /> : null}
        </GoogleMap>

        {!shouldShowMarker ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-3 w-3 rounded-full border border-white/80 bg-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.45)]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
