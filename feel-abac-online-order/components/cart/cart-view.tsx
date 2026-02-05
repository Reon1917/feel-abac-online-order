"use client";

import { useMemo, useState, useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { useMenuLocale } from "@/components/i18n/menu-locale-provider";
import type { CartRecord } from "@/lib/cart/types";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart/types";
import type {
  DeliveryLocationOption,
  DeliverySelection,
} from "@/lib/delivery/types";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { DeliveryLocationPicker } from "./delivery-location-picker";
import { SwipeToRemove } from "@/components/cart/swipe-to-remove";
import { emitCartChange } from "@/lib/cart/events";
import { extractActiveOrderBlock } from "@/lib/orders/active-order";

type CartDictionary = typeof import("@/dictionaries/en/cart.json");

type CartViewProps = {
  cart: CartRecord | null;
  dictionary: CartDictionary;
  menuHref: string;
  deliveryLocations: DeliveryLocationOption[];
  defaultDeliverySelection: DeliverySelection | null;
  savedCustomSelection: DeliverySelection | null;
  locale: Locale;
};

type CartItemRecord = CartRecord["items"][number];

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CartView({
  cart,
  dictionary,
  menuHref,
  deliveryLocations,
  defaultDeliverySelection,
  savedCustomSelection,
  locale,
}: CartViewProps) {
  const { menuLocale } = useMenuLocale();
  const router = useRouter();
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [visibleNotes, setVisibleNotes] = useState<Record<string, boolean>>({});
  const [pendingItems, setPendingItems] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<CartItemRecord | null>(null);
  const [editingQuantity, setEditingQuantity] = useState(1);
  const [locationValidationError, setLocationValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deliverySelection, setDeliverySelection] = useState<DeliverySelection | null>(
    () => {
      if (!defaultDeliverySelection) {
        return null;
      }

      if (defaultDeliverySelection.mode === "preset") {
        const locationExists = deliveryLocations.some(
          (location) => location.id === defaultDeliverySelection.locationId
        );
        if (!locationExists) {
          return null;
        }
        return {
          mode: "preset",
          locationId: defaultDeliverySelection.locationId,
          buildingId: defaultDeliverySelection.buildingId ?? null,
        };
      }

      return {
        mode: "custom",
        customCondoName: defaultDeliverySelection.customCondoName,
        customBuildingName: defaultDeliverySelection.customBuildingName,
        placeId: defaultDeliverySelection.placeId,
        coordinates: defaultDeliverySelection.coordinates,
      };
    }
  );
  const quantityLabel = dictionary.items.quantityLabel;
  const quantityLabelLower = quantityLabel.toLowerCase();
  const decrementAria = dictionary.items.decrement;
  const incrementAria = dictionary.items.increment;
  const editLabel = dictionary.items.edit;
  const editModalTitle = dictionary.items.editModalTitle;
  const editModalBody = dictionary.items.editModalBody;
  const editModalLimit = dictionary.items.editModalLimit.replace(
    "{{max}}",
    String(MAX_QUANTITY_PER_LINE)
  );
  const editModalHint = dictionary.items.editModalHint;
  const editModalSave = dictionary.items.editModalSave;
  const editModalRemove = dictionary.items.editModalRemove;
  const editModalCancel = dictionary.items.editModalCancel;
  const editModalSaving = dictionary.items.editModalSaving;
  const removeSuccessMessage =
    dictionary.items.removeToast ?? "Item removed from cart";
  const removeErrorMessage =
    dictionary.items.removeError ?? "Unable to remove this item.";
  const removeLabel = dictionary.items.remove;
  const deliveryDictionary = dictionary.delivery;
  const selectedDeliveryLocation = useMemo(() => {
    if (deliverySelection?.mode !== "preset") {
      return null;
    }
    return (
      deliveryLocations.find(
        (location) => location.id === deliverySelection.locationId
      ) ?? null
    );
  }, [deliveryLocations, deliverySelection]);

  // Validate selected location and building on mount and when selection changes
  useEffect(() => {
    if (deliverySelection?.mode === "custom") {
      setLocationValidationError(null);
      return;
    }

    if (!deliverySelection || deliverySelection.mode !== "preset") {
      return;
    }

    const location = deliveryLocations.find(
      (loc) => loc.id === deliverySelection.locationId
    );

    if (!location) {
      const errorMessage = deliveryDictionary.unavailableSelection || "Selected delivery location is no longer available. Please select a new location.";
      setLocationValidationError(errorMessage);
      toast.error(errorMessage);
      setDeliverySelection(null);
      return;
    }

    if (deliverySelection.buildingId) {
      const buildingExists = location.buildings.some(
        (building) => building.id === deliverySelection.buildingId
      );

      if (!buildingExists) {
        const errorMessage = deliveryDictionary.unavailableBuilding;
        setLocationValidationError(errorMessage);
        toast.error(errorMessage);
        setDeliverySelection({
          mode: "preset",
          locationId: deliverySelection.locationId,
          buildingId: null,
        });
        return;
      }
    }

    setLocationValidationError(null);
  }, [deliverySelection, deliveryLocations, deliveryDictionary]);

  const setItemPending = (itemId: string, isPending: boolean) => {
    setPendingItems((prev) => ({
      ...prev,
      [itemId]: isPending,
    }));
  };

  const handleRemoveItem = async (itemId: string) => {
    setItemPending(itemId, true);
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? removeErrorMessage);
      }

      toast.success(removeSuccessMessage);
      router.refresh();
      emitCartChange();
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : removeErrorMessage;
      toast.error(message);
      return false;
    } finally {
      setItemPending(itemId, false);
    }
  };

  const openEditModal = (item: CartItemRecord) => {
    setEditingItem(item);
    setEditingQuantity(item.quantity);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditingQuantity(1);
  };

  const validateDeliverySelection = (): DeliverySelection | null => {
    if (!deliverySelection) {
      const errorMessage =
        deliveryDictionary.errors?.locationRequired ??
        "Please select a delivery location.";
      setLocationValidationError(errorMessage);
      toast.error(errorMessage);
      return null;
    }

    if (deliverySelection.mode === "custom") {
      if (
        !deliverySelection.customCondoName ||
        deliverySelection.customCondoName.trim().length === 0
      ) {
        const errorMessage =
          deliveryDictionary.errors?.customRequired ??
          "Custom condo name required.";
        setLocationValidationError(errorMessage);
        toast.error(errorMessage);
        return null;
      }
    }

    setLocationValidationError(null);
    return deliverySelection;
  };

  const handleSendOrder = async () => {
    if (!cart || cart.items.length === 0) {
      toast.error(dictionary.summary.empty);
      return;
    }

    const selection = validateDeliverySelection();
    if (!selection) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliverySelection: selection,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.order?.displayId) {
        const activeOrder = extractActiveOrderBlock(payload);

        if (activeOrder) {
          const message =
            dictionary.activeOrderBlock?.message ??
            "You can place a new order after payment for your current order is verified.";
          const ctaLabel = dictionary.activeOrderBlock?.cta ?? "View order";
          setSubmitError(message);
          toast.error(message, {
            action: {
              label: ctaLabel,
              onClick: () => {
                router.push(
                  withLocalePath(locale, `/orders/${activeOrder.displayId}`)
                );
              },
            },
          });
          return;
        }

        throw new Error(payload?.error ?? "Unable to place order");
      }

      const displayId: string = payload.order.displayId;
      toast.success(dictionary.summary.checkoutCta);
      try {
        localStorage.setItem("lastOrderDisplayId", displayId);
      } catch {
        // ignore storage failures
      }
      router.push(withLocalePath(locale, `/orders/${displayId}`));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to place order";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const performQuantityUpdate = async (
    item: CartItemRecord,
    nextQuantity: number
  ) => {
    const normalizedQuantity = Math.max(
      0,
      Math.min(MAX_QUANTITY_PER_LINE, nextQuantity)
    );

    if (normalizedQuantity === item.quantity) {
      closeEditModal();
      return;
    }

    setItemPending(item.id, true);
    try {
      const response = await fetch(`/api/cart/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: normalizedQuantity }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "Unable to update this item.";
        throw new Error(message);
      }

      router.refresh();
      emitCartChange();
      closeEditModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update this item.";
      toast.error(message);
    } finally {
      setItemPending(item.id, false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) {
      return;
    }
    await performQuantityUpdate(editingItem, editingQuantity);
  };

  if (!cart || cart.items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">
          {dictionary.empty.heading}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{dictionary.empty.body}</p>
        <Link
          href={menuHref}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {dictionary.empty.cta}
        </Link>
      </section>
    );
  }

  const itemCount = cart.items.length;
  const totalQuantity = cart.items.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const itemCountLabel =
    itemCount === 1
      ? dictionary.summary.itemsLabel.one
      : dictionary.summary.itemsLabel.other.replace(
          "{{count}}",
          String(itemCount)
        );

  const editingPending = editingItem ? !!pendingItems[editingItem.id] : false;
  const editingDisplayName = editingItem
    ? menuLocale === "my"
      ? editingItem.menuItemNameMm ?? editingItem.menuItemName
      : editingItem.menuItemName
    : "";
  const editingUnitPrice = editingItem
    ? editingItem.basePrice + editingItem.addonsTotal
    : 0;
  const editingLineTotal = editingUnitPrice * editingQuantity;
  const canSubmitEdit =
    editingItem != null && editingQuantity !== editingItem.quantity;
  const editPrimaryLabel =
    editingQuantity === 0 ? editModalRemove : editModalSave;

  const handleModalBackgroundClick = (
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget && !editingPending) {
      closeEditModal();
    }
  };

  const selectedBuildingLabel =
    deliverySelection?.mode === "preset" &&
    deliverySelection.buildingId &&
    selectedDeliveryLocation &&
    Array.isArray(selectedDeliveryLocation.buildings)
      ? selectedDeliveryLocation.buildings.find(
          (building) => building.id === deliverySelection.buildingId
        )?.label ?? null
      : null;

  const locationTriggerLabel = deliverySelection
    ? deliveryDictionary.changeCta
    : deliveryDictionary.chooseCta;

  const locationSummaryLabel = (() => {
    if (!deliverySelection) {
      return deliveryDictionary.notSelected;
    }
    if (deliverySelection.mode === "custom") {
      return deliverySelection.customBuildingName
        ? `${deliverySelection.customCondoName} · ${deliverySelection.customBuildingName}`
        : deliverySelection.customCondoName;
    }
    if (selectedDeliveryLocation) {
      return selectedBuildingLabel
        ? `${selectedDeliveryLocation.condoName} · ${selectedBuildingLabel}`
        : selectedDeliveryLocation.condoName;
    }
    return deliveryDictionary.unavailableSelection;
  })();

  const locationFeeLabel =
    selectedDeliveryLocation?.minFee != null &&
    selectedDeliveryLocation?.maxFee != null
      ? `฿${selectedDeliveryLocation.minFee}–${selectedDeliveryLocation.maxFee}`
      : null;

  return (
    <>
      <div className="mb-6">
        <Link
          href={menuHref}
          className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-5 py-2.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
        >
          {dictionary.empty.cta}
        </Link>
      </div>
      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-3.5 pb-72 sm:pb-64 lg:pb-0">
        {cart.items.map((item) => {
          const displayName =
            menuLocale === "my"
              ? item.menuItemNameMm ?? item.menuItemName
              : item.menuItemName;
          const unitPrice = item.basePrice + item.addonsTotal;
          const groupedChoices = groupChoices(item.choices, menuLocale);
          const isExpanded = !!expandedDetails[item.id];
          const noteVisible = !!visibleNotes[item.id];
          const isPending = !!pendingItems[item.id];
          const canEdit = !isPending;

          return (
            <SwipeToRemove
              key={item.id}
              onRemove={() => handleRemoveItem(item.id)}
              disabled={isPending}
              removeLabel={removeLabel}
            >
              <article className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <header className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">
                      {displayName}
                    </h3>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {quantityLabel}: {item.quantity}
                    </p>
                    <p className="text-xs text-slate-500">
                      ฿{formatPrice(unitPrice)} / {quantityLabelLower}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {dictionary.items.priceLabel}
                    </span>
                    <p className="text-base font-semibold text-emerald-600">
                      ฿{formatPrice(item.totalPrice)}
                    </p>
                  </div>
                </header>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    disabled={!canEdit}
                    className="rounded-full border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {editLabel}
                  </button>
                  {groupedChoices.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDetails((prev) => ({
                          ...prev,
                          [item.id]: !isExpanded,
                        }))
                      }
                      className="rounded-full border border-emerald-200 px-2.5 py-0.5 transition hover:bg-emerald-50"
                    >
                      {isExpanded
                        ? dictionary.items.hideDetails
                        : dictionary.items.showDetails}
                    </button>
                  ) : null}

                  {item.note ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleNotes((prev) => ({
                          ...prev,
                          [item.id]: !noteVisible,
                        }))
                      }
                      className="rounded-full border border-amber-200 px-2.5 py-0.5 text-amber-800 transition hover:bg-amber-50"
                    >
                      {noteVisible
                        ? dictionary.items.hideNote
                        : dictionary.items.showNote}
                    </button>
                  ) : null}
                </div>

                {isExpanded && groupedChoices.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {dictionary.items.choicesHeading}
                    </p>
                    <div className="space-y-2">
                      {groupedChoices.map((group) => (
                        <div key={group.id}>
                          <p className="text-sm font-medium text-slate-700">
                            {group.label}
                          </p>
                          <ul className="mt-1 space-y-1 text-[13px] text-slate-600">
                            {group.options.map((option) => (
                              <li
                                key={option.id}
                                className="flex items-center justify-between"
                              >
                                <span>{option.label}</span>
                                {option.extraPrice > 0 ? (
                                  <span className="text-xs font-semibold text-emerald-600">
                                    +฿{formatPrice(option.extraPrice)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                    +฿0.00
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.note && noteVisible ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {dictionary.items.noteLabel}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{item.note}</p>
                  </div>
                ) : null}
              </article>
            </SwipeToRemove>
          );
        })}
        <div className="lg:hidden rounded-3xl border border-emerald-100 bg-white p-4 shadow-inner shadow-emerald-100/60">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {deliveryDictionary.label}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 leading-tight shadow-inner">
                {locationSummaryLabel}
              </div>
              {locationFeeLabel ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  {deliveryDictionary.feeRangeLabel}: {locationFeeLabel}
                </span>
              ) : null}
              {deliverySelection?.mode === "custom" ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {deliveryDictionary.customBadge}
                </span>
              ) : null}
              {locationValidationError ? (
                <p className="text-xs font-semibold text-red-600">
                  {locationValidationError}
                </p>
              ) : null}
            </div>
            <div className="w-full">
              <DeliveryLocationPicker
                locations={deliveryLocations}
                selection={deliverySelection}
                savedCustomSelection={
                  savedCustomSelection?.mode === "custom"
                    ? savedCustomSelection
                    : null
                }
                dictionary={deliveryDictionary}
                triggerLabel={locationTriggerLabel}
                triggerClassName="w-full justify-center rounded-2xl border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-300"
                onSelectionChange={setDeliverySelection}
              />
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[4.5rem] max-lg:z-30 max-lg:mx-4 max-lg:rounded-2xl max-lg:border max-lg:bg-white max-lg:shadow-[0_-8px_20px_rgba(15,23,42,0.12)] sm:max-lg:bottom-4 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-2.5 text-sm max-lg:text-[13px]">
          <h2 className="text-base font-semibold text-slate-900">
            {dictionary.summary.heading}
          </h2>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>{itemCountLabel}</span>
            <span>
              {totalQuantity} {dictionary.items.quantityLabel}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 text-sm max-lg:text-[13px]">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900">
                {dictionary.summary.foodSubtotal}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {dictionary.summary.vatIncluded}
              </span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              ฿{formatPrice(cart.subtotal)}
            </span>
          </div>
        </div>

        <div className="hidden rounded-3xl border border-emerald-100 bg-white p-4 shadow-inner shadow-emerald-100/60 lg:block">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {deliveryDictionary.label}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 leading-tight shadow-inner">
                {locationSummaryLabel}
              </div>
              {locationFeeLabel ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  {deliveryDictionary.feeRangeLabel}: {locationFeeLabel}
                </span>
              ) : null}
              {deliverySelection?.mode === "custom" ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {deliveryDictionary.customBadge}
                </span>
              ) : null}
              {locationValidationError ? (
                <p className="text-xs font-semibold text-red-600">
                  {locationValidationError}
                </p>
              ) : null}
            </div>
            <div className="w-full">
              <DeliveryLocationPicker
                locations={deliveryLocations}
                selection={deliverySelection}
                savedCustomSelection={
                  savedCustomSelection?.mode === "custom"
                    ? savedCustomSelection
                    : null
                }
                dictionary={deliveryDictionary}
                triggerLabel={locationTriggerLabel}
                triggerClassName="w-full justify-center rounded-2xl border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-300"
                onSelectionChange={setDeliverySelection}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {submitError}
            </div>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={
              isSubmitting ||
              !cart ||
              cart.items.length === 0 ||
              Boolean(locationValidationError)
            }
            onClick={() => void handleSendOrder()}
          >
            {isSubmitting ? dictionary.summary.checkoutCta + "..." : dictionary.summary.checkoutCta}
          </button>
        </div>

      </aside>
    </div>
    {editingItem ? (
      <>
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[1px]"
          aria-hidden="true"
        />
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6"
          onClick={handleModalBackgroundClick}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editModalTitle}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {editModalTitle}
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingDisplayName}
              </h3>
              <p className="text-xs text-slate-500">{editModalBody}</p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label={decrementAria}
                disabled={editingPending || editingQuantity <= 0}
                onClick={() =>
                  setEditingQuantity((prev) =>
                    Math.max(0, prev - 1)
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                -
              </button>
              <div className="text-center">
                <span
                  className={`text-3xl font-semibold ${
                    editingQuantity === 0 ? "text-rose-500" : "text-slate-900"
                  }`}
                >
                  {editingQuantity}
                </span>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {quantityLabel}
                </p>
              </div>
              <button
                type="button"
                aria-label={incrementAria}
                disabled={
                  editingPending || editingQuantity >= MAX_QUANTITY_PER_LINE
                }
                onClick={() =>
                  setEditingQuantity((prev) =>
                    Math.min(MAX_QUANTITY_PER_LINE, prev + 1)
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-xl text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {editModalHint}
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{editModalLimit}</span>
              <span className="text-sm font-semibold text-slate-900">
                ฿{formatPrice(editingLineTotal)}
              </span>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editingPending}
                className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editModalCancel}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!canSubmitEdit || editingPending}
                className="flex-1 rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingPending ? editModalSaving : editPrimaryLabel}
              </button>
            </div>
          </div>
        </div>
      </>
    ) : null}
    </>
  );
}

function groupChoices(
  choices: CartRecord["items"][number]["choices"],
  menuLocale: string
) {
  const map = new Map<
    string,
    { id: string; label: string; isSetMenu: boolean; options: Array<{ id: string; label: string; extraPrice: number; menuCode: string | null }> }
  >();

  for (const choice of choices) {
    const groupLabel =
      menuLocale === "my"
        ? choice.groupNameMm ?? choice.groupName
        : choice.groupName;
    const optionLabel =
      menuLocale === "my"
        ? choice.optionNameMm ?? choice.optionName
        : choice.optionName;

    const groupKey = `${choice.cartItemId}:${choice.groupName}`;
    const group =
      map.get(groupKey) ??
      {
        id: groupKey,
        label: groupLabel,
        isSetMenu: !!choice.selectionRole,
        options: [],
      };

    group.options.push({
      id: `${choice.id}-${choice.optionName}`,
      label: optionLabel,
      extraPrice: choice.extraPrice,
      menuCode: choice.menuCode,
    });

    map.set(groupKey, group);
  }

  return Array.from(map.values());
}
