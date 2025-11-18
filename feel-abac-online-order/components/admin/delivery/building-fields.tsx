"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type AdminDeliveryDictionary = typeof import("@/dictionaries/en/admin-delivery.json");

type BuildingFieldsSectionProps = {
  dictionary: AdminDeliveryDictionary["form"];
  hasBuildings: boolean;
  onHasBuildingsChange: (checked: boolean) => void;
  buildingFields: string[];
  onBuildingChange: (index: number, value: string) => void;
  onAddBuilding: () => void;
  onRemoveBuilding: (index: number) => void;
};

export function BuildingFieldsSection({
  dictionary,
  hasBuildings,
  onHasBuildingsChange,
  buildingFields,
  onBuildingChange,
  onAddBuilding,
  onRemoveBuilding,
}: BuildingFieldsSectionProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{dictionary.buildings}</p>
          <p className="text-xs text-slate-500">{dictionary.buildingsToggle}</p>
        </div>
        <Switch checked={hasBuildings} onCheckedChange={onHasBuildingsChange} />
      </div>

      {hasBuildings ? (
        <div className="space-y-3 rounded-xl border border-dashed border-emerald-200 bg-white/80 p-3">
          {buildingFields.map((value, index) => (
            <div key={`building-field-${index}`} className="flex items-center gap-2">
              <Input
                value={value}
                onChange={(event) => onBuildingChange(index, event.target.value)}
                placeholder={dictionary.buildingsPlaceholder}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveBuilding(index)}
              >
                {dictionary.buildingsRemove}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddBuilding}
            className="w-full border-dashed"
          >
            {dictionary.buildingsAdd}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
