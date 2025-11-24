import type { LatLngPoint } from "./location-coordinates";

export type DeliveryBuildingRecord = {
  id: string;
  locationId: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryLocationRecord = {
  id: string;
  slug: string;
  condoName: string;
  area: string;
  minFee: number;
  maxFee: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  buildings: DeliveryBuildingRecord[];
};

export type DeliveryLocationOption = {
  id: string;
  slug: string;
  condoName: string;
  area: string;
  minFee: number;
  maxFee: number;
  notes: string | null;
  buildings: {
    id: string;
    locationId: string;
    label: string;
  }[];
};

export type PresetDeliverySelection = {
  mode: "preset";
  locationId: string;
  buildingId: string | null;
};

export type CustomDeliverySelection = {
  mode: "custom";
  customCondoName: string;
  customBuildingName: string;
  placeId?: string; // Google Maps place_id - enables FREE Place Details (IDs Only) calls
  coordinates?: LatLngPoint | null;
};

export type DeliverySelection = PresetDeliverySelection | CustomDeliverySelection;
