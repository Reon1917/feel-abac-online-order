"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PublicSetMenuPoolLink,
  PublicSetMenuPoolOption,
} from "@/lib/menu/types";
import type { SetMenuSelection } from "@/lib/cart/types";

type SetMenuBuilderProps = {
  poolLinks: PublicSetMenuPoolLink[];
  menuLocale: "en" | "my";
  onAddToCart: (
    selections: SetMenuSelection[],
    quantity: number
  ) => Promise<void>;
  isSubmitting?: boolean;
  onTotalsChange?: (totals: {
    basePrice: number;
    addonsTotal: number;
    totalPrice: number;
    quantity: number;
  }) => void;
};

export type SetMenuBuilderSelection = SetMenuSelection;

type SelectedOptions = Map<string, Set<string>>; // poolLinkId -> Set<optionId>

function formatPrice(value: number): string {
  return value.toLocaleString("en-US");
}

function PoolSection({
  link,
  menuLocale,
  selectedOptions,
  onToggle,
}: {
  link: PublicSetMenuPoolLink;
  menuLocale: "en" | "my";
  selectedOptions: Set<string>;
  onToggle: (optionId: string) => void;
}) {
  const label = menuLocale === "my" ? link.labelMm ?? link.label : link.label;
  const poolName = menuLocale === "my" ? link.pool.nameMm ?? link.pool.name : link.pool.name;
  const isSingleSelect = link.maxSelect === 1;
  const isMultiSelect = link.maxSelect > 1;
  const selectedCount = selectedOptions.size;
  const isBase = link.isPriceDetermining;

  const helperText = isBase
    ? "Base · Required · Sets base price"
    : link.isRequired
      ? `Required add-on${isMultiSelect ? ` · Up to ${link.maxSelect}` : ""}`
      : `Optional add-on${isMultiSelect ? ` · Up to ${link.maxSelect}` : ""}`;

  // Calculate price display
  const getPriceDisplay = (option: PublicSetMenuPoolOption): string => {
    if (link.isPriceDetermining) {
      return `฿${formatPrice(option.price)}`;
    }
    if (!link.usesOptionPrice && link.flatPrice !== null) {
      return `+฿${formatPrice(link.flatPrice)}`;
    }
    if (option.price > 0) {
      return `+฿${formatPrice(option.price)}`;
    }
    return "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-slate-900">
            {label ?? poolName}
          </h3>
          <p className="text-xs text-slate-500">{helperText}</p>
        </div>
        {isMultiSelect && selectedCount > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="space-y-2">
        {link.pool.options.map((option) => {
          const isSelected = selectedOptions.has(option.id);
          const optionName = menuLocale === "my" 
            ? option.nameMm ?? option.name 
            : option.name;
          const priceDisplay = getPriceDisplay(option);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              disabled={!option.isAvailable}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                isSelected
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300",
                !option.isAvailable && "cursor-not-allowed opacity-50"
              )}
            >
              {/* Selection indicator */}
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-slate-300 bg-white",
                  isSingleSelect && "rounded-full",
                  isMultiSelect && "rounded-md"
                )}
              >
                {isSelected && (
                  <CheckIcon className="h-3 w-3 text-white" />
                )}
              </div>

              {/* Option info */}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-slate-900 truncate">
                  {optionName}
                </span>
              </div>

              {/* Price */}
              {priceDisplay && (
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    link.isPriceDetermining ? "text-emerald-600" : "text-slate-600"
                  )}
                >
                  {priceDisplay}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SetMenuBuilder({
  poolLinks,
  menuLocale,
  onAddToCart,
  isSubmitting = false,
  onTotalsChange,
}: SetMenuBuilderProps) {
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>(new Map());
  const [quantity, setQuantity] = useState(1);

  // Sort pool links by display order
  const sortedLinks = useMemo(
    () => [...poolLinks].sort((a, b) => a.displayOrder - b.displayOrder),
    [poolLinks]
  );

  // Handle option toggle
  const handleToggle = useCallback(
    (poolLinkId: string, link: PublicSetMenuPoolLink, optionId: string) => {
      setSelectedOptions((prev) => {
        const next = new Map(prev);
        const currentSet = next.get(poolLinkId) ?? new Set();

        if (currentSet.has(optionId)) {
          // Deselect
          currentSet.delete(optionId);
        } else {
          // Select
          if (link.maxSelect === 1) {
            // Single select - replace
            currentSet.clear();
          } else if (currentSet.size >= link.maxSelect) {
            // Max reached
            toast.error(`Maximum ${link.maxSelect} selections allowed`);
            return prev;
          }
          currentSet.add(optionId);
        }

        if (currentSet.size === 0) {
          next.delete(poolLinkId);
        } else {
          next.set(poolLinkId, currentSet);
        }

        return next;
      });
    },
    []
  );

  // Calculate total price and build selections for cart
  const { basePrice, addonsTotal, totalPrice, isValid, selections } = useMemo(() => {
    let base = 0;
    let addons = 0;
    let valid = true;
    const builtSelections: SetMenuSelection[] = [];

    for (const link of sortedLinks) {
      const selected = selectedOptions.get(link.id);
      const count = selected?.size ?? 0;

      // Check required
      if (link.isRequired && count === 0) {
        valid = false;
      }

      // Calculate price
      if (selected) {
        for (const optionId of selected) {
          const option = link.pool.options.find((o) => o.id === optionId);
          if (!option) continue;

          const isFlatAddon =
            !link.isPriceDetermining &&
            !link.usesOptionPrice &&
            link.flatPrice !== null;

          const unitPrice = isFlatAddon ? (link.flatPrice ?? 0) : option.price;

          if (link.isPriceDetermining) {
            base = unitPrice;
          } else {
            addons += unitPrice;
          }

          builtSelections.push({
            poolLinkId: link.id,
            optionId: option.id,
          });
        }
      }
    }

    const total = (base + addons) * quantity;
    return {
      basePrice: base,
      addonsTotal: addons,
      totalPrice: total,
      isValid: valid,
      selections: builtSelections,
    };
  }, [sortedLinks, selectedOptions, quantity]);

  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      basePrice,
      addonsTotal,
      totalPrice,
      quantity,
    });
  }, [addonsTotal, basePrice, onTotalsChange, quantity, totalPrice]);

  // Handle add to cart
  const handleAddToCart = useCallback(async () => {
    if (!isValid) {
      toast.error("Please complete all required selections");
      return;
    }

    await onAddToCart(selections, quantity);
  }, [isValid, selections, onAddToCart, quantity]);

  return (
    <div className="flex flex-col">
      {/* Pool sections */}
      <div className="space-y-6 pb-32">
        {sortedLinks.map((link) => (
          <PoolSection
            key={link.id}
            link={link}
            menuLocale={menuLocale}
            selectedOptions={selectedOptions.get(link.id) ?? new Set()}
            onToggle={(optionId) =>
              handleToggle(link.id, link, optionId)
            }
          />
        ))}
      </div>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white px-4 py-4 shadow-lg sm:px-6">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          {/* Quantity */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:opacity-40"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-medium text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              disabled={quantity >= 20}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:opacity-40"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Add to cart button */}
          <Button
            onClick={handleAddToCart}
            disabled={!isValid || isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              "Adding..."
            ) : (
              <>
                Add to Cart · ฿{formatPrice(totalPrice)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
