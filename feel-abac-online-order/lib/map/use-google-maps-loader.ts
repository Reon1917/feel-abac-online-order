import { useJsApiLoader } from "@react-google-maps/api";
import { useMemo } from "react";

const SCRIPT_ID = "feel-abac-google-maps";

type UseJsApiLoaderOptions = Parameters<typeof useJsApiLoader>[0];
type Library = NonNullable<UseJsApiLoaderOptions["libraries"]>[number];
const BASE_LIBRARIES: readonly Library[] = ["places"] as const;

function mergeLibraries(
  base: readonly Library[],
  extras?: UseJsApiLoaderOptions["libraries"]
): Library[] {
  const values = new Set<Library>(base ?? []);
  extras?.forEach((lib) => {
    if (lib) {
      values.add(lib as Library);
    }
  });
  return Array.from(values);
}

export function useGoogleMapsLoader(
  options?: Partial<UseJsApiLoaderOptions>
) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  // Memoize libraries to avoid recreating arrays and reloading the script.
  const libraryList = options?.libraries ?? null;
  const libraries = useMemo(
    () => (libraryList ? mergeLibraries(BASE_LIBRARIES, libraryList) : [...BASE_LIBRARIES]),
    [libraryList]
  );

  return useJsApiLoader({
    ...options,
    id: SCRIPT_ID,
    googleMapsApiKey: apiKey,
    preventGoogleFontsLoading: true,
    libraries,
  });
}
