import { useJsApiLoader, type UseLoadScriptOptions } from "@react-google-maps/api";
import { useMemo } from "react";

const SCRIPT_ID = "feel-abac-google-maps";
const BASE_LIBRARIES: UseLoadScriptOptions["libraries"] = ["places"];

function mergeLibraries(
  base: UseLoadScriptOptions["libraries"],
  extras?: UseLoadScriptOptions["libraries"]
) {
  const values = new Set<string>(base ?? []);
  extras?.forEach((lib) => {
    if (lib) {
      values.add(lib);
    }
  });
  return Array.from(values);
}

export function useGoogleMapsLoader(
  options?: Partial<UseLoadScriptOptions>
) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  // Memoize libraries to avoid recreating arrays and reloading the script.
  const libraryList = options?.libraries ?? null;
  const libraries = useMemo(
    () => (libraryList ? mergeLibraries(BASE_LIBRARIES, libraryList) : BASE_LIBRARIES),
    [libraryList]
  );

  return useJsApiLoader({
    id: SCRIPT_ID,
    googleMapsApiKey: apiKey,
    preventGoogleFontsLoading: true,
    ...options,
    id: SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries,
  });
}
