"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ChevronDownIcon } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import {
  MenuCategoryRecord,
  MenuChoiceGroup,
  MenuChoiceGroupType,
  MenuChoiceOption,
  MenuItemRecord,
  MenuItemStatus,
  SetMenuPoolRole,
} from "@/lib/menu/types";
import { defaultHeaders, fetchJSON } from "./api-client";
import { useAdminMenuStore } from "./store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MENU_CHOICE_GROUP_TYPES } from "@/lib/menu/validators";

type MenuEditorProps = {
  refreshMenu: (opts?: { categoryId?: string | null; itemId?: string | null }) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onPreviewChange?: (snapshot: MenuEditorPreviewSnapshot | null) => void;
};

type MenuOptionFormValue = {
  id?: string;
  nameEn: string;
  nameMm: string;
  extraPrice: string;
  isAvailable: boolean;
};

type MenuChoiceGroupFormValue = {
  id?: string;
  titleEn: string;
  titleMm: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  type: MenuChoiceGroupType;
  options: MenuOptionFormValue[];
};

type SetMenuPoolLinkFormValue = {
  role: SetMenuPoolRole;
  poolId: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  isPriceDetermining: boolean;
  usesOptionPrice: boolean;
  flatPrice: string;
  displayOrder: number;
};

type MenuEditorFormValues = {
  id?: string;
  categoryId: string | null;
  nameEn: string;
  nameMm?: string;
  descriptionEn?: string;
  descriptionMm?: string;
  placeholderIcon?: string;
  menuCode?: string;
  price: string;
  isAvailable: boolean;
  isSetMenu: boolean;
  allowUserNotes: boolean;
  status: MenuItemStatus;
  choiceGroups: MenuChoiceGroupFormValue[];
  poolLinks: SetMenuPoolLinkFormValue[];
};

export type MenuEditorPreviewSnapshot = {
  itemId: string | null;
  categoryId: string | null;
  categoryNameEn: string;
  categoryNameMm: string | null;
  nameEn: string;
  nameMm?: string;
  descriptionEn?: string;
  descriptionMm?: string;
  price: number;
  menuCode?: string;
  placeholderIcon?: string | null;
  imageUrl: string | null;
  allowUserNotes: boolean;
  choiceGroups: Array<{
    id?: string;
    titleEn: string;
    titleMm?: string;
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    type: MenuChoiceGroupType;
    options: Array<{
      id?: string;
      nameEn: string;
      nameMm?: string;
      extraPrice: number;
      isAvailable: boolean;
    }>;
  }>;
};

const FALLBACK_IMAGE = "/menu-placeholders/placeholder-img-1.png";

const CHOICE_TYPE_LABEL: Record<MenuChoiceGroupType, string> = {
  single: "Pick one",
  multi: "Pick many",
  toggle: "On/off",
  dropdown: "Dropdown list",
  quantity: "With quantity",
};

const STATUS_BADGE_STYLES: Record<MenuItemStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
};

const NO_POOL_VALUE = "__none__";

const SET_MENU_ROLES: SetMenuPoolRole[] = [
  "base_curry",
  "addon_curry",
  "addon_veggie",
];

const SET_MENU_ROLE_LABELS: Record<SetMenuPoolRole, string> = {
  base_curry: "Base selection",
  addon_curry: "Add-on group 1",
  addon_veggie: "Add-on group 2",
};

const SET_MENU_ROLE_DESCRIPTIONS: Record<SetMenuPoolRole, string> = {
  base_curry: "Required base that typically sets the starting price.",
  addon_curry: "Optional add-ons such as extra mains or toppings.",
  addon_veggie: "Optional add-ons such as sides, drinks, or extras.",
};

const PRIMARY_BUTTON_CLASS =
  "border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500";
const SUBTLE_BUTTON_CLASS =
  "border border-emerald-200 text-emerald-700 hover:bg-emerald-50";
const SWITCH_TONE_CLASS =
  "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-200";
const DANGER_BUTTON_CLASS =
  "border border-rose-500 bg-rose-500 text-white shadow-sm hover:bg-rose-500/90";
const COMPACT_INPUT_CLASS = "h-9";
const COMPACT_SELECT_TRIGGER_CLASS = "h-9";

const PLACEHOLDER_ICON_OPTIONS = [
  { value: "🍜", label: "Noodle bowl" },
  { value: "🍣", label: "Sushi roll" },
  { value: "🍔", label: "Burger" },
  { value: "🥗", label: "Fresh salad" },
  { value: "🍕", label: "Pizza slice" },
  { value: "🍤", label: "Seafood" },
  { value: "🍛", label: "Curry" },
  { value: "🍱", label: "Bento" },
  { value: "🥟", label: "Dumplings" },
] as const;

const DRAFT_STORAGE_PREFIX = "menu-editor-draft:";
const PERSISTABLE_FIELDS: Array<keyof MenuEditorFormValues> = [
  "nameEn",
  "nameMm",
  "descriptionEn",
  "descriptionMm",
  "placeholderIcon",
  "menuCode",
  "price",
  "isAvailable",
  "allowUserNotes",
];

type DraftDiff = {
  payload: Record<string, unknown>;
  changedFields: Set<string>;
  hasChanges: boolean;
};

type StoredDraftPayload = {
  values: Partial<MenuEditorFormValues>;
  updatedAt: number;
};

type NormalizedPoolLinkForPayload = {
  poolId: string;
  role: SetMenuPoolRole;
  isPriceDetermining: boolean;
  usesOptionPrice: boolean;
  flatPrice: number | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
};

function buildDefaultPoolLink(role: SetMenuPoolRole, displayOrder: number): SetMenuPoolLinkFormValue {
  if (role === "base_curry") {
    return {
      role,
      poolId: null,
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      isPriceDetermining: true,
      usesOptionPrice: true,
      flatPrice: "",
      displayOrder,
    };
  }

  return {
    role,
    poolId: null,
    isRequired: false,
    minSelect: 0,
    maxSelect: 3,
    isPriceDetermining: false,
    usesOptionPrice: true,
    flatPrice: "",
    displayOrder,
  };
}

function buildPoolLinksFromItem(
  item: MenuItemRecord | null | undefined
): SetMenuPoolLinkFormValue[] {
  const base = SET_MENU_ROLES.map((role, index) =>
    buildDefaultPoolLink(role, index)
  );

  if (!item?.poolLinks || item.poolLinks.length === 0) {
    return base;
  }

  return base.map((defaultLink) => {
    const existing = item.poolLinks?.find(
      (link) => link.role === defaultLink.role
    );
    if (!existing) {
      return defaultLink;
    }

    return {
      role: existing.role,
      poolId: existing.pool.id,
      isRequired: existing.isRequired,
      minSelect: existing.minSelect,
      maxSelect: existing.maxSelect,
      isPriceDetermining: existing.isPriceDetermining,
      usesOptionPrice: existing.usesOptionPrice,
      flatPrice:
        existing.flatPrice != null ? existing.flatPrice.toString() : "",
      displayOrder: existing.displayOrder,
    };
  });
}

function normalizePoolLinksFromItem(
  item: MenuItemRecord | null
): NormalizedPoolLinkForPayload[] {
  if (!item?.poolLinks || item.poolLinks.length === 0) {
    return [];
  }

  return item.poolLinks
    .map((link) => ({
      poolId: link.pool.id,
      role: link.role,
      isPriceDetermining: link.isPriceDetermining ?? false,
      usesOptionPrice: link.usesOptionPrice ?? true,
      flatPrice: link.flatPrice ?? null,
      isRequired: link.isRequired ?? true,
      minSelect: link.minSelect ?? 1,
      maxSelect: link.maxSelect ?? 99,
      displayOrder: link.displayOrder ?? 0,
    }))
    .sort((a, b) => {
      if (a.displayOrder === b.displayOrder) {
        return a.role.localeCompare(b.role);
      }
      return a.displayOrder - b.displayOrder;
    });
}

function buildPoolLinksPayloadFromForm(
  values: MenuEditorFormValues
): NormalizedPoolLinkForPayload[] {
  const links = values.poolLinks ?? [];
  const activeLinks = links.filter((link) => link.poolId);

  if (activeLinks.length === 0 || !values.isSetMenu) {
    return [];
  }

  return activeLinks
    .map((link, index) => {
      const flatPriceValue = link.flatPrice?.trim() ?? "";
      const parsedFlat = Number.parseFloat(flatPriceValue);
      const flatPrice =
        flatPriceValue.length > 0 && Number.isFinite(parsedFlat)
          ? parsedFlat
          : null;

      return {
        poolId: link.poolId as string,
        role: link.role,
        isPriceDetermining: link.isPriceDetermining,
        usesOptionPrice: link.usesOptionPrice,
        flatPrice,
        isRequired: link.isRequired,
        minSelect: link.minSelect,
        maxSelect: link.maxSelect,
        displayOrder:
          typeof link.displayOrder === "number"
            ? link.displayOrder
            : index,
      };
    })
    .sort((a, b) => {
      if (a.displayOrder === b.displayOrder) {
        return a.role.localeCompare(b.role);
      }
      return a.displayOrder - b.displayOrder;
    });
}

function getDraftStorageKey(itemId: string) {
  return `${DRAFT_STORAGE_PREFIX}${itemId}`;
}

function loadDraftFromStorage(itemId: string): Partial<MenuEditorFormValues> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(itemId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraftPayload | undefined;
    if (parsed && parsed.values && typeof parsed.values === "object") {
      return parsed.values;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to load menu draft", error);
    }
  }
  return null;
}

function saveDraftToStorage(itemId: string, values: Partial<MenuEditorFormValues>) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraftPayload = {
      values,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getDraftStorageKey(itemId), JSON.stringify(payload));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to persist menu draft", error);
    }
  }
}

function clearDraftFromStorage(itemId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(itemId));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to clear menu draft", error);
    }
  }
}

function pickPersistableValues(values: MenuEditorFormValues): Partial<MenuEditorFormValues> {
  return PERSISTABLE_FIELDS.reduce<Partial<MenuEditorFormValues>>((acc, field) => {
    const value = values[field];
    if (value !== undefined && value !== null) {
      (acc as Record<string, unknown>)[field] = value;
    }
    return acc;
  }, {});
}

function buildDraftDiff(
  item: MenuItemRecord | null,
  values: MenuEditorFormValues
): DraftDiff {
  if (!item) {
    return { payload: {}, changedFields: new Set(), hasChanges: false };
  }

  const payload: Record<string, unknown> = {};
  const changedFields = new Set<string>();

  const normalizedNameEn = values.nameEn?.trim() ?? "";
  if (normalizedNameEn && normalizedNameEn !== item.nameEn) {
    payload.nameEn = normalizedNameEn;
    changedFields.add("nameEn");
  }

  const normalizedNameMm = values.nameMm?.trim() ?? "";
  if ((item.nameMm ?? "") !== normalizedNameMm) {
    payload.nameMm = normalizedNameMm || undefined;
    changedFields.add("nameMm");
  }

  const normalizedDescriptionEn = values.descriptionEn?.trim() ?? "";
  if ((item.descriptionEn ?? "") !== normalizedDescriptionEn) {
    payload.descriptionEn = normalizedDescriptionEn || undefined;
    changedFields.add("descriptionEn");
  }

  const normalizedDescriptionMm = values.descriptionMm?.trim() ?? "";
  if ((item.descriptionMm ?? "") !== normalizedDescriptionMm) {
    payload.descriptionMm = normalizedDescriptionMm || undefined;
    changedFields.add("descriptionMm");
  }

  const normalizedPlaceholder = values.placeholderIcon?.trim() ?? "";
  if ((item.placeholderIcon ?? "") !== normalizedPlaceholder) {
    payload.placeholderIcon = normalizedPlaceholder || undefined;
    changedFields.add("placeholderIcon");
  }

  const normalizedMenuCode = values.menuCode?.trim() ?? "";
  if ((item.menuCode ?? "") !== normalizedMenuCode) {
    payload.menuCode = normalizedMenuCode || undefined;
    changedFields.add("menuCode");
  }

  const priceInput = values.price?.trim() ?? "";
  if (priceInput.length > 0) {
    const parsedPrice = Number.parseFloat(priceInput);
    if (!Number.isNaN(parsedPrice) && parsedPrice >= 0) {
      if (item.price !== parsedPrice) {
        payload.price = parsedPrice;
        changedFields.add("price");
      }
    }
  }

  if (values.isAvailable !== item.isAvailable) {
    payload.isAvailable = values.isAvailable;
    changedFields.add("isAvailable");
  }

  if (values.isSetMenu !== item.isSetMenu) {
    payload.isSetMenu = values.isSetMenu;
    changedFields.add("isSetMenu");
  }

  if (values.allowUserNotes !== item.allowUserNotes) {
    payload.allowUserNotes = values.allowUserNotes;
    changedFields.add("allowUserNotes");
  }

  // Set menu pool links (for set menu items)
  const existingPoolLinks = normalizePoolLinksFromItem(item);
  const currentPoolLinks = buildPoolLinksPayloadFromForm(values);

  if (
    JSON.stringify(existingPoolLinks) !==
    JSON.stringify(currentPoolLinks)
  ) {
    payload.poolLinks = currentPoolLinks;
    changedFields.add("poolLinks");
  }

  const hasChanges = changedFields.size > 0;
  return { payload, changedFields, hasChanges };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function itemToFormValues(
  item: MenuItemRecord | null | undefined,
  categoryId: string | null
): MenuEditorFormValues {
  if (!item) {
    return {
      id: undefined,
      categoryId,
      nameEn: "",
      nameMm: "",
      descriptionEn: "",
      descriptionMm: "",
      placeholderIcon: "",
      menuCode: "",
      price: "",
      isAvailable: true,
      isSetMenu: false,
      allowUserNotes: false,
      status: "draft",
      choiceGroups: [],
      poolLinks: buildPoolLinksFromItem(null),
    };
  }

  return {
    id: item.id,
    categoryId: item.categoryId,
    nameEn: item.nameEn,
    nameMm: item.nameMm ?? "",
    descriptionEn: item.descriptionEn ?? "",
    descriptionMm: item.descriptionMm ?? "",
    placeholderIcon: item.placeholderIcon ?? "",
    menuCode: item.menuCode ?? "",
    price: item.price ? item.price.toString() : "",
    isAvailable: item.isAvailable,
    isSetMenu: item.isSetMenu,
    allowUserNotes: item.allowUserNotes,
    status: item.status,
    choiceGroups: (item.choiceGroups ?? []).map((group) => ({
      id: group.id,
      titleEn: group.titleEn,
      titleMm: group.titleMm ?? "",
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      isRequired: group.isRequired,
      type: group.type,
      options: (group.options ?? []).map((option) => ({
        id: option.id,
        nameEn: option.nameEn,
        nameMm: option.nameMm ?? "",
        extraPrice: option.extraPrice ? option.extraPrice.toString() : "0",
        isAvailable: option.isAvailable,
      })),
    })),
    poolLinks: buildPoolLinksFromItem(item),
  };
}

type ChoiceGroupField = MenuChoiceGroupFormValue & { fieldId: string };

export function MenuEditor({ refreshMenu, onDirtyChange, onPreviewChange }: MenuEditorProps) {
  const menu = useAdminMenuStore((state) => state.menu);
  const selectedCategoryId = useAdminMenuStore((state) => state.selectedCategoryId);
  const selectedItemId = useAdminMenuStore((state) => state.selectedItemId);
  const updateItem = useAdminMenuStore((state) => state.updateItem);

  const selectedCategory = useMemo<MenuCategoryRecord | null>(() => {
    if (!selectedCategoryId) return null;
    return menu.find((category) => category.id === selectedCategoryId) ?? null;
  }, [menu, selectedCategoryId]);

  const selectedItem = useMemo<MenuItemRecord | null>(() => {
    if (!selectedCategory || !selectedItemId) return null;
    return (
      selectedCategory.items.find((item) => item.id === selectedItemId) ?? null
    );
  }, [selectedCategory, selectedItemId]);

  const computeDraftDiff = useCallback(
    (values: MenuEditorFormValues): DraftDiff =>
      buildDraftDiff(selectedItem, values),
    [selectedItem]
  );

  const form = useForm<MenuEditorFormValues>({
    mode: "onChange",
    defaultValues: itemToFormValues(selectedItem, selectedCategory?.id ?? null),
  });

  const { fields: groupFields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "choiceGroups",
    keyName: "fieldId",
  });

  const getStatusButtonClass = (isActive: boolean) =>
    isActive ? PRIMARY_BUTTON_CLASS : SUBTLE_BUTTON_CLASS;

  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isChoiceMutating, setIsChoiceMutating] = useState(false);
  const [isImageMutating, setIsImageMutating] = useState(false);
  const [imageDialogMode, setImageDialogMode] = useState<"none" | "replace" | "remove">("none");

  const isImageDialogOpen = imageDialogMode !== "none";
  const closeImageDialog = () => setImageDialogMode("none");

  useEffect(() => {
    const baseValues = itemToFormValues(selectedItem, selectedCategory?.id ?? null);
    let nextValues = baseValues;
    if (selectedItem?.id) {
      const storedDraft = loadDraftFromStorage(selectedItem.id);
      if (storedDraft) {
        nextValues = {
          ...baseValues,
          ...storedDraft,
        };
      }
    }
    form.reset(nextValues);
    setAutosaveError(null);
    setLastSavedAt(null);
  }, [selectedCategory?.id, selectedItem, form]);

  const watchedValues =
    (useWatch<MenuEditorFormValues>({ control: form.control }) ??
      form.getValues()) as MenuEditorFormValues;
  const watchedChoiceGroups = useMemo(
    () => watchedValues.choiceGroups ?? [],
    [watchedValues.choiceGroups]
  );
  const currentStatus = watchedValues.status ?? "draft";
  const draftDiff = useMemo(
    () => computeDraftDiff(watchedValues),
    [computeDraftDiff, watchedValues]
  );
  const hasPendingFieldChanges = draftDiff.hasChanges;
  const changedFields = draftDiff.changedFields;
  const draftActionAvailable =
    currentStatus !== "draft" || hasPendingFieldChanges;
  const publishActionAvailable =
    currentStatus !== "published" || hasPendingFieldChanges;
  const draftButtonDisabled =
    isAutosaving || isChoiceMutating || !draftActionAvailable;
  const publishButtonDisabled =
    isAutosaving || isChoiceMutating || !publishActionAvailable;

  const previewSnapshot = useMemo<MenuEditorPreviewSnapshot | null>(() => {
    if (!selectedCategory && !selectedItem && !watchedValues.nameEn?.trim()) {
      return null;
    }

    const parsedPrice = Number.parseFloat(watchedValues.price ?? "");
    const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
    const placeholderIconValue = watchedValues.placeholderIcon ?? "";
    const placeholderIcon = placeholderIconValue.trim() || selectedItem?.placeholderIcon || null;

    const groups = (watchedChoiceGroups ?? []).map((group) => {
      const minSelect = Number.isFinite(group.minSelect) ? group.minSelect : 0;
      const maxSelect = Number.isFinite(group.maxSelect) ? group.maxSelect : 0;

      return {
        id: group.id,
        titleEn: group.titleEn ?? "",
        titleMm: group.titleMm ?? "",
        isRequired: !!group.isRequired,
        minSelect,
        maxSelect,
        type: group.type ?? "single",
        options: (group.options ?? []).map((option) => {
          const parsedExtra = Number.parseFloat(option.extraPrice ?? "0");
          return {
            id: option.id,
            nameEn: option.nameEn ?? "",
            nameMm: option.nameMm ?? "",
            extraPrice: Number.isFinite(parsedExtra) ? parsedExtra : 0,
            isAvailable: option.isAvailable ?? true,
          };
        }),
      } satisfies MenuEditorPreviewSnapshot["choiceGroups"][number];
    });

    return {
      itemId: selectedItem?.id ?? null,
      categoryId: selectedCategory?.id ?? null,
      categoryNameEn: selectedCategory?.nameEn ?? "",
      categoryNameMm: selectedCategory?.nameMm ?? null,
      nameEn: watchedValues.nameEn ?? "",
      nameMm: watchedValues.nameMm ?? "",
      descriptionEn: watchedValues.descriptionEn ?? "",
      descriptionMm: watchedValues.descriptionMm ?? "",
      price,
      menuCode: watchedValues.menuCode ?? "",
      placeholderIcon,
      imageUrl: selectedItem?.imageUrl ?? null,
      allowUserNotes: !!watchedValues.allowUserNotes,
      choiceGroups: groups,
    } satisfies MenuEditorPreviewSnapshot;
  }, [selectedCategory, selectedItem, watchedChoiceGroups, watchedValues]);

  useEffect(() => {
    onPreviewChange?.(previewSnapshot);
  }, [previewSnapshot, onPreviewChange]);

  useEffect(() => {
    if (!selectedItem?.id) return;
    if (!hasPendingFieldChanges) {
      clearDraftFromStorage(selectedItem.id);
      return;
    }
    const persistable = pickPersistableValues(watchedValues);
    saveDraftToStorage(selectedItem.id, persistable);
  }, [hasPendingFieldChanges, selectedItem?.id, watchedValues]);

  useEffect(() => {
    onDirtyChange(
      isAutosaving || hasPendingFieldChanges || isChoiceMutating
    );
  }, [hasPendingFieldChanges, isAutosaving, isChoiceMutating, onDirtyChange]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPendingFieldChanges || isAutosaving || isChoiceMutating) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingFieldChanges, isAutosaving, isChoiceMutating]);

  const createGroup = useCallback(
    async (input: {
      titleEn: string;
      titleMm?: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
      type: MenuChoiceGroupType;
    }) => {
      if (!selectedItem) {
        toast.error("Pick a menu item before adding a choices section.");
        return;
      }
      const menuItemId = selectedItem.id?.trim();
      if (!menuItemId) {
        toast.error("This menu item is missing an ID.");
        return;
      }

      setIsChoiceMutating(true);
      try {
        const { group } = await fetchJSON<{ group: MenuChoiceGroup }>(
          "/api/admin/menu/choice-groups",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
              ...input,
              menuItemId: menuItemId,
              displayOrder: groupFields.length,
            }),
          }
        );

        append({
          id: group.id,
          titleEn: group.titleEn,
          titleMm: group.titleMm ?? "",
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          type: group.type,
          options: [],
        });

        updateItem({
          itemId: menuItemId,
          categoryId: selectedItem.categoryId,
          updates: {
            choiceGroups: [
              ...(selectedItem.choiceGroups ?? []),
              { ...group, options: [] },
            ],
          },
        });

        toast.success("Section added");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't add that section"
        );
      } finally {
        setIsChoiceMutating(false);
      }
    },
    [append, groupFields.length, selectedItem, updateItem]
  );

  const updateGroup = useCallback(
    async (groupId: string, values: Partial<MenuChoiceGroupFormValue>) => {
      const normalizedGroupId = groupId.trim();
      if (!normalizedGroupId) {
        toast.error("This section is missing an ID.");
        return;
      }
      setIsChoiceMutating(true);
      try {
        await fetchJSON<{ group: MenuChoiceGroup }>(
          `/api/admin/menu/choice-groups/${normalizedGroupId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({
              titleEn: values.titleEn?.trim() || undefined,
              titleMm: values.titleMm?.trim() || undefined,
              minSelect: values.minSelect,
              maxSelect: values.maxSelect,
              isRequired: values.isRequired,
              type: values.type,
            }),
          }
        );
        toast.success("Section updated");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't update that section"
        );
      } finally {
        setIsChoiceMutating(false);
      }
    },
    []
  );

  const deleteGroup = useCallback(
    async (groupId: string, index: number) => {
      if (!selectedItem) return;
      const normalizedGroupId = groupId.trim();
      if (!normalizedGroupId) {
        toast.error("This section is missing an ID.");
        return;
      }
      setIsChoiceMutating(true);
      try {
        await fetchJSON<{ success: boolean }>(
          `/api/admin/menu/choice-groups/${normalizedGroupId}`,
          { method: "DELETE" }
        );
        remove(index);
        const menuItemId = selectedItem.id?.trim() ?? "";
        updateItem({
          itemId: menuItemId,
          categoryId: selectedItem.categoryId,
          updates: {
            choiceGroups: selectedItem.choiceGroups.filter(
              (group) => group.id?.trim() !== normalizedGroupId
            ),
          },
        });
        toast.success("Section removed");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't remove that section"
        );
      } finally {
        setIsChoiceMutating(false);
      }
    },
    [remove, selectedItem, updateItem]
  );

  const reorderGroups = useCallback(
    async (from: number, to: number) => {
      move(from, to);
      const nextGroups = form.getValues("choiceGroups");
      setIsChoiceMutating(true);
      try {
        await Promise.all(
          nextGroups.map((group, index) => {
            if (!group.id) return Promise.resolve();
            return fetchJSON<{ group: MenuChoiceGroup }>(
              `/api/admin/menu/choice-groups/${group.id.trim()}`,
              {
                method: "PATCH",
                headers: defaultHeaders,
                body: JSON.stringify({ displayOrder: index }),
              }
            );
          })
        );
        toast.success("Sections reordered");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't reorder those sections"
        );
        move(to, from);
      } finally {
        setIsChoiceMutating(false);
      }
    },
    [form, move]
  );

  const createOption = useCallback(
    async (groupId: string, displayOrder: number) => {
      const normalizedGroupId = groupId.trim();
      if (!normalizedGroupId) {
        toast.error("This section is missing an ID.");
        return null;
      }
      setIsChoiceMutating(true);
      try {
        const { option } = await fetchJSON<{ option: MenuChoiceOption }>(
          "/api/admin/menu/choice-options",
          {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
              choiceGroupId: normalizedGroupId,
              nameEn: "New option",
              displayOrder,
            }),
          }
        );
        toast.success("Choice added");
        return option;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't add that choice"
        );
        return null;
      } finally {
        setIsChoiceMutating(false);
      }
    },
    []
  );

  const updateOption = useCallback(
    async (optionId: string, values: MenuOptionFormValue) => {
      const normalizedOptionId = optionId.trim();
      if (!normalizedOptionId) {
        toast.error("This choice is missing an ID.");
        return;
      }
      setIsChoiceMutating(true);
      try {
        await fetchJSON<{ option: MenuChoiceOption }>(
          `/api/admin/menu/choice-options/${normalizedOptionId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({
              nameEn: values.nameEn?.trim() || undefined,
              nameMm: values.nameMm?.trim() || undefined,
              extraPrice: values.extraPrice
                ? Number.parseFloat(values.extraPrice)
                : 0,
              isAvailable: values.isAvailable,
            }),
          }
        );
        toast.success("Choice updated");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't update that choice"
        );
      } finally {
        setIsChoiceMutating(false);
      }
    },
    []
  );

  const deleteOption = useCallback(async (optionId: string) => {
    const normalizedOptionId = optionId.trim();
    if (!normalizedOptionId) {
      toast.error("This choice is missing an ID.");
      return false;
    }
    setIsChoiceMutating(true);
    try {
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/choice-options/${normalizedOptionId}`,
        { method: "DELETE" }
      );
      toast.success("Choice removed");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      toast.error(
        error instanceof Error ? error.message : "Couldn't remove that choice"
      );
      return false;
    } finally {
      setIsChoiceMutating(false);
    }
  }, []);

  const reorderOptions = useCallback(
    async (
      updates: Array<{ optionId: string; displayOrder: number }>
    ) => {
      setIsChoiceMutating(true);
      try {
        await Promise.all(
          updates.map(({ optionId, displayOrder }) =>
            fetchJSON<{ option: MenuChoiceOption }>(
              `/api/admin/menu/choice-options/${optionId.trim()}`,
              {
                method: "PATCH",
                headers: defaultHeaders,
                body: JSON.stringify({ displayOrder }),
              }
            )
          )
        );
        toast.success("Choices reordered");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't reorder those choices"
        );
        throw error;
      } finally {
        setIsChoiceMutating(false);
      }
    },
    []
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (isImageMutating) {
        toast.error("Please wait for the current image action to finish.");
        return;
      }

      const maxBytes = 2 * 1024 * 1024; // ~2 MB
      if (file.size > maxBytes) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        toast.error(`Image is too large (${sizeMb} MB). Please upload a file under 2 MB.`);
        return;
      }

      if (!selectedItem) {
        toast.error("Save the item before uploading an image.");
        return;
      }
      const menuItemId = selectedItem.id?.trim();
      if (!menuItemId) {
        toast.error("Menu item is missing an ID.");
        return;
      }
      const formData = new FormData();
      formData.append("menuItemId", menuItemId);
      formData.append("file", file);

      try {
        setIsImageMutating(true);
        const response = await fetch("/api/admin/menu/images", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Failed to upload image"
          );
        }
        toast.success("Image uploaded");
        await refreshMenu({
          categoryId: selectedCategory?.id ?? null,
          itemId: menuItemId,
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        toast.error(
          error instanceof Error ? error.message : "Image upload failed"
        );
      } finally {
        setIsImageMutating(false);
      }
    },
    [isImageMutating, refreshMenu, selectedCategory?.id, selectedItem]
  );

  const handleImageDelete = useCallback(async () => {
    if (!selectedItem) return;
    const menuItemId = selectedItem.id?.trim();
    if (!menuItemId) {
      toast.error("Menu item is missing an ID.");
      return;
    }
    try {
      setIsImageMutating(true);
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/images?menuItemId=${menuItemId}`,
        { method: "DELETE" }
      );
      toast.success("Image removed");
      await refreshMenu({
        categoryId: selectedCategory?.id ?? null,
        itemId: menuItemId,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to delete image"
      );
    } finally {
      setIsImageMutating(false);
    }
  }, [refreshMenu, selectedCategory?.id, selectedItem]);

  const setStatus = useCallback(
    async (status: MenuItemStatus) => {
      if (!selectedItem) return;
      const itemId = selectedItem.id?.trim();
      if (!itemId) {
        toast.error("Menu item is missing an ID.");
        return;
      }

      const currentValues = form.getValues();
      const { payload, hasChanges } = computeDraftDiff(currentValues);
      const statusChanged = selectedItem.status !== status;

      if (!hasChanges && !statusChanged) {
        toast.info("No changes to save yet.");
        return;
      }

      setIsAutosaving(true);
      setAutosaveError(null);
      try {
        const requestBody: Record<string, unknown> = { ...payload };
        if (statusChanged) {
          requestBody.status = status;
        }

        const { item } = await fetchJSON<{ item: MenuItemRecord }>(
          `/api/admin/menu/items/${itemId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify(requestBody),
          }
        );

        updateItem({
          itemId: item.id,
          categoryId: item.categoryId,
          updates: item,
        });

        clearDraftFromStorage(itemId);
        const nextValues = itemToFormValues(item, item.categoryId);
        form.reset(nextValues);
        setLastSavedAt(new Date());
        toast.success(
          status === "published"
            ? "Changes published"
            : "Draft saved"
        );
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        const message =
          error instanceof Error ? error.message : "Failed to update item";
        setAutosaveError(message);
        toast.error(message);
      } finally {
        setIsAutosaving(false);
      }
    },
    [computeDraftDiff, form, selectedItem, updateItem]
  );

  const deleteItem = useCallback(async () => {
    if (!selectedItem) return;
    if (
      !window.confirm(
        "Deleting this menu item removes all choice groups, options, and its image. Continue?"
      )
    ) {
      return;
    }
    try {
      if (selectedItem.id) {
        clearDraftFromStorage(selectedItem.id);
      }
      await fetchJSON<{ success: boolean }>(
        `/api/admin/menu/items/${selectedItem.id.trim()}`,
        { method: "DELETE" }
      );
      toast.success("Menu item deleted");
      await refreshMenu({
        categoryId: selectedCategory?.id ?? null,
        itemId: null,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item"
      );
    }
  }, [refreshMenu, selectedCategory?.id, selectedItem]);

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  if (!selectedCategory) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Select a category to get started
          </CardTitle>
          <CardDescription>
            Step 1: choose or create a category on the left. The editor will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!selectedItem) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Add a menu item under {selectedCategory.nameEn}
          </CardTitle>
          <CardDescription>
            Use the “New menu item” button to create a draft. Autosave keeps your work safe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12 xl:items-start 2xl:grid-cols-12">
      <Card className="shadow-sm xl:order-1 xl:col-span-7">
        <CardHeader className="border-b border-slate-100 pb-6">
          <CardTitle className="text-2xl font-semibold text-slate-900">
            Step 3 · Menu details
          </CardTitle>
          <CardDescription className="space-y-2 text-sm text-slate-600">
            <p>
              Every change autosaves to draft. Publish only when you are happy with the preview.
            </p>
            <p>
              Status:{" "}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  STATUS_BADGE_STYLES[currentStatus]
                )}
              >
                {currentStatus === "published" ? "Published" : "Draft"}
              </span>
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {isAutosaving ? (
                <span className="font-medium text-emerald-600">Saving…</span>
              ) : autosaveError ? (
                <span className="font-medium text-rose-600">{autosaveError}</span>
              ) : lastSavedAt ? (
                <span>
                  Autosaved at{" "}
                  {lastSavedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                <span>Waiting for changes…</span>
              )}
              {isChoiceMutating && (
                <span className="font-medium text-emerald-600">
                  Syncing choice groups…
                </span>
              )}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <FormSection
            title="Item basics"
            description="Name your dish and set quick identifiers diners will see first."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label="Name (English)" required changed={changedFields.has("nameEn")}>
                <Input
                  {...form.register("nameEn")}
                  placeholder="e.g. Grilled chicken bowl"
                />
              </FieldBlock>
              <FieldBlock label="Name (Burmese)" changed={changedFields.has("nameMm")}>
                <Input
                  {...form.register("nameMm")}
                  placeholder="မြန်မာလို အမည်"
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldBlock
                label="Price"
                description="Enter numbers only"
                required
                changed={changedFields.has("price")}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("price")}
                  placeholder="0.00"
                />
              </FieldBlock>
              <FieldBlock
                label="Menu code"
                description="Shows on orders like A-12"
                changed={changedFields.has("menuCode")}
              >
                <Input
                  {...form.register("menuCode")}
                  placeholder="e.g. A-12"
                  maxLength={32}
                />
              </FieldBlock>
              <FieldBlock
                label="Placeholder icon"
                description="Pick a fallback emoji for dishes without photos."
                changed={changedFields.has("placeholderIcon")}
              >
                <Controller
                  control={form.control}
                  name="placeholderIcon"
                  render={({ field }) => (
                    <Select
                      value={
                        field.value && field.value.length > 0
                          ? field.value
                          : undefined
                      }
                      onValueChange={(value) => {
                        if (value === "__clear__") {
                          field.onChange("");
                          return;
                        }
                        field.onChange(value);
                      }}
                    >
                      <SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="Choose an icon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__">No icon</SelectItem>
                        {PLACEHOLDER_ICON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="mr-2 text-lg">{option.value}</span>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Descriptions"
            description="Tell diners what makes this item special in both languages."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label="Description (English)"
                changed={changedFields.has("descriptionEn")}
              >
                <Textarea
                  {...form.register("descriptionEn")}
                  rows={3}
                  placeholder="Share ingredients or tasting notes."
                />
              </FieldBlock>
              <FieldBlock
                label="Description (Burmese)"
                changed={changedFields.has("descriptionMm")}
              >
                <Textarea
                  {...form.register("descriptionMm")}
                  rows={3}
                  placeholder="အကြောင်းအရာ"
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Availability & ordering"
            description="Control what guests see and whether they can leave special notes."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleBlock
                label="In stock"
                description="Turn off when the kitchen runs out—diners will see it grayed out."
                changed={changedFields.has("isAvailable")}
              >
                <Controller
                  control={form.control}
                  name="isAvailable"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className={SWITCH_TONE_CLASS}
                    />
                  )}
                />
              </ToggleBlock>
              <ToggleBlock
                label="Allow order notes"
                description="Enable diners to send requests with their order."
                changed={changedFields.has("allowUserNotes")}
              >
                <Controller
                  control={form.control}
                  name="allowUserNotes"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className={SWITCH_TONE_CLASS}
                    />
                  )}
                />
              </ToggleBlock>
              <ToggleBlock
                label="Set Menu item"
                description="Enable to make this a configurable set menu with choice pools."
                changed={changedFields.has("isSetMenu")}
              >
                <Controller
                  control={form.control}
                  name="isSetMenu"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className={SWITCH_TONE_CLASS}
                    />
                  )}
                />
              </ToggleBlock>
            </div>
          </FormSection>
        </CardContent>
      </Card>

      <Card className="shadow-sm xl:order-3 xl:col-span-12">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-slate-900">
            Step 3 · Choices & add-ons
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Bundle sides, toppings, and upsells into tidy sections. Drag cards to reorder and keep the menu clear.
            For set menus, attach choice pools in the “Set menu pools” screen, then link them here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SetMenuPoolsPanel form={form} />
          <ChoiceGroupPanel
            form={form}
            groupFields={groupFields}
            onCreateGroup={createGroup}
            onUpdateGroup={updateGroup}
            onDeleteGroup={deleteGroup}
            onReorderGroup={reorderGroups}
            onCreateOption={createOption}
            onUpdateOption={updateOption}
            onDeleteOption={deleteOption}
            onReorderOption={reorderOptions}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStatus("draft")}
                  disabled={draftButtonDisabled}
                  className={cn(
                    getStatusButtonClass(draftActionAvailable),
                    "transition-colors",
                    draftButtonDisabled && "opacity-60"
                  )}
                >
                  Save as draft
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    getStatusButtonClass(publishActionAvailable),
                    "transition-colors",
                    publishButtonDisabled && "opacity-60"
                  )}
                  type="button"
                  onClick={() => setStatus("published")}
                  disabled={publishButtonDisabled}
                >
                  Publish changes
                </Button>
              </div>
            <Button
              variant="destructive"
              type="button"
              onClick={() => void deleteItem()}
              className={DANGER_BUTTON_CLASS}
            >
              Delete this item
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="sticky top-6 h-fit border-emerald-100 bg-emerald-50/70 shadow-none backdrop-blur xl:order-2 xl:col-span-5">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-emerald-900">
            Step 4 · Live preview
          </CardTitle>
          <CardDescription className="text-sm text-emerald-800">
            Preview updates instantly. Publish when everything looks perfect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <figure className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
            <div className="relative aspect-4/3 w-full bg-emerald-100">
              <Image
                fill
                className="object-cover"
                src={selectedItem.imageUrl ?? FALLBACK_IMAGE}
                alt={watchedValues.nameEn || "Menu preview"}
              />
            </div>
            <figcaption className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">
                    {watchedValues.nameEn || "Untitled item"}
                  </h4>
                  {watchedValues.nameMm && (
                    <p className="text-sm text-slate-500">
                      {watchedValues.nameMm}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {watchedValues.price ? (
                    <span className="text-base font-semibold text-emerald-700">
                      {formatCurrency(Number(watchedValues.price))}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Add price</span>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                {watchedValues.descriptionEn ? (
                  <p>{watchedValues.descriptionEn}</p>
                ) : (
                  <p className="italic text-slate-400">
                    Add a mouthwatering description to entice diners.
                  </p>
                )}
                {watchedValues.descriptionMm && (
                  <p className="text-slate-500">{watchedValues.descriptionMm}</p>
                )}
              </div>
              <div className="space-y-3">
                {watchedChoiceGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    No choice groups yet. Use them for toppings, sizes, or combos.
                  </div>
                ) : (
                  watchedChoiceGroups.map((group) => (
                    <div
                      key={group.id ?? group.titleEn}
                      className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-sm font-semibold text-emerald-900">
                          {group.titleEn || "Untitled group"}
                        </h5>
                        <span className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                          {CHOICE_TYPE_LABEL[group.type]}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(group.options ?? []).length === 0 ? (
                          <p className="text-xs italic text-emerald-700">
                            Add options so diners can make a choice.
                          </p>
                        ) : (
                          (group.options ?? []).map((option) => (
                            <div
                              key={option.id ?? option.nameEn}
                              className="flex items-center justify-between text-sm text-emerald-900"
                            >
                              <span>{option.nameEn || "Unnamed option"}</span>
                              <span className="text-xs font-medium text-emerald-700">
                                {option.extraPrice &&
                                Number(option.extraPrice) > 0
                                  ? `+${formatCurrency(
                                      Number(option.extraPrice)
                                    )}`
                                  : "Included"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </figcaption>
          </figure>
          <div className="space-y-3">
            <Button
              variant="outline"
              className={cn("w-full", SUBTLE_BUTTON_CLASS)}
              type="button"
              disabled={isImageMutating}
              onClick={() => {
                if (selectedItem?.imageUrl) {
                  setImageDialogMode("replace");
                } else {
                  imageInputRef.current?.click();
                }
              }}
            >
              {isImageMutating ? "Working on image…" : "Upload image"}
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImageUpload(file);
                  event.target.value = "";
                }
              }}
            />
            {selectedItem.imageUrl && (
              <Button
                variant="ghost"
                className="w-full text-rose-600 hover:text-rose-700"
                type="button"
                disabled={isImageMutating}
                onClick={() => setImageDialogMode("remove")}
              >
                Remove current image
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isImageDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closeImageDialog();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {imageDialogMode === "remove"
                ? "Remove current image?"
                : "Replace existing image?"}
            </DialogTitle>
            <DialogDescription>
              {imageDialogMode === "remove"
                ? "This will remove the image from this menu item. You can upload a new one later."
                : "Uploading a new image will replace the existing one for this menu item."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isImageMutating}
              onClick={closeImageDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={imageDialogMode === "remove" ? DANGER_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
              disabled={isImageMutating}
              onClick={async () => {
                if (imageDialogMode === "remove") {
                  await handleImageDelete();
                  closeImageDialog();
                } else if (imageDialogMode === "replace") {
                  closeImageDialog();
                  imageInputRef.current?.click();
                }
              }}
            >
              {imageDialogMode === "remove" ? "Remove image" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type FieldBlockProps = {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

function FieldBlock({
  label,
  required,
  description,
  children,
  className,
  changed,
}: FieldBlockProps & { changed?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
        {changed ? (
          <span className="ml-1 text-amber-500" aria-label="Unsaved change">
            *
          </span>
        ) : null}
      </span>
      {children}
      {description ? (
        <span className="text-xs text-slate-500">{description}</span>
      ) : null}
    </label>
  );
}

type ToggleBlockProps = {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

function ToggleBlock({
  label,
  description,
  children,
  className,
  changed,
}: ToggleBlockProps & { changed?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
        className
      )}
    >
      <div className="w-full space-y-1 sm:w-auto">
        <p className="text-sm font-semibold text-slate-800">
          {label}
          {changed ? (
            <span className="ml-1 text-amber-500" aria-label="Unsaved change">
              *
            </span>
          ) : null}
        </p>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="sm:self-center">{children}</div>
    </div>
  );
}

type ChoiceGroupPanelProps = {
  form: UseFormReturn<MenuEditorFormValues>;
  groupFields: ChoiceGroupField[];
  onCreateGroup: (values: {
    titleEn: string;
    titleMm?: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
    type: MenuChoiceGroupType;
  }) => Promise<void>;
  onUpdateGroup: (groupId: string, values: Partial<MenuChoiceGroupFormValue>) => Promise<void>;
  onDeleteGroup: (groupId: string, index: number) => Promise<void>;
  onReorderGroup: (from: number, to: number) => Promise<void>;
  onCreateOption: (groupId: string, displayOrder: number) => Promise<MenuChoiceOption | null>;
  onUpdateOption: (optionId: string, values: MenuOptionFormValue) => Promise<void>;
  onDeleteOption: (optionId: string) => Promise<boolean>;
  onReorderOption: (
    updates: Array<{ optionId: string; displayOrder: number }>
  ) => Promise<void>;
};

function ChoiceGroupPanel({
  form,
  groupFields,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onReorderGroup,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  onReorderOption,
}: ChoiceGroupPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const newGroupForm = useForm<Omit<MenuChoiceGroupFormValue, "id" | "options">>({
    defaultValues: {
      titleEn: "",
      titleMm: "",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
      type: "single",
    },
  });

  const handleCreateGroup = newGroupForm.handleSubmit(async (values) => {
    await onCreateGroup({
      titleEn: values.titleEn,
      titleMm: values.titleMm?.trim() || undefined,
      minSelect: values.minSelect,
      maxSelect: values.maxSelect,
      isRequired: values.isRequired,
      type: values.type,
    });
    newGroupForm.reset();
    setDialogOpen(false);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Choices sections
          </h4>
          <p className="text-sm text-slate-600">
            Group add-ons, sizes, or toppings into sections so guests always know what to pick.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" className={PRIMARY_BUTTON_CLASS}>
              Add choices section
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white text-slate-900">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Create choices section
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Give the section a clear name and decide how diners can make their picks.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4 text-slate-900"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateGroup();
              }}
            >
              <FieldBlock label="Section title" required>
                <Input
                  className={cn(COMPACT_INPUT_CLASS, "border-slate-200 bg-white text-slate-900")}
                  {...newGroupForm.register("titleEn", { required: true })}
                  placeholder="e.g. Choose your base"
                />
              </FieldBlock>
              <FieldBlock label="Section title (Burmese)">
                <Input
                  className={cn(COMPACT_INPUT_CLASS, "border-slate-200 bg-white text-slate-900")}
                  {...newGroupForm.register("titleMm")}
                  placeholder="အမည်"
                />
              </FieldBlock>
              <FieldBlock label="Selection style" required>
                <Controller
                  control={newGroupForm.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value: MenuChoiceGroupType) => field.onChange(value)}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full border-slate-200 bg-white text-slate-900",
                          COMPACT_SELECT_TRIGGER_CLASS
                        )}
                      >
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {MENU_CHOICE_GROUP_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {CHOICE_TYPE_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldBlock>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Minimum picks">
                  <Input
                    type="number"
                    min={0}
                    className={cn(COMPACT_INPUT_CLASS, "border-slate-200 bg-white text-slate-900")}
                    {...newGroupForm.register("minSelect", {
                      valueAsNumber: true,
                    })}
                  />
                </FieldBlock>
                <FieldBlock label="Maximum picks" required>
                  <Input
                    type="number"
                    min={1}
                    className={cn(COMPACT_INPUT_CLASS, "border-slate-200 bg-white text-slate-900")}
                    {...newGroupForm.register("maxSelect", {
                      valueAsNumber: true,
                    })}
                  />
                </FieldBlock>
              </div>
              <ToggleBlock
                label="Require a choice"
                description="Turn on if guests must pick something here."
                className="border-slate-200 bg-slate-50"
              >
                <Controller
                  control={newGroupForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className={SWITCH_TONE_CLASS}
                    />
                  )}
                />
              </ToggleBlock>
              <DialogFooter>
                <Button type="submit" className={PRIMARY_BUTTON_CLASS}>
                  Create section
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groupFields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-emerald-700">
          No choice sections yet. Create one to collect sides, toppings, or upgrades.
        </div>
      ) : (
        <div className="space-y-4">
          {groupFields.map((group, index) => (
            <ChoiceGroupCard
              key={group.id ?? group.fieldId}
              form={form}
              groupField={group}
              index={index}
              onUpdateGroup={onUpdateGroup}
              onDeleteGroup={onDeleteGroup}
              onReorderGroup={onReorderGroup}
              onCreateOption={onCreateOption}
              onUpdateOption={onUpdateOption}
              onDeleteOption={onDeleteOption}
              onReorderOption={onReorderOption}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ChoiceGroupCardProps = {
  form: UseFormReturn<MenuEditorFormValues>;
  groupField: ChoiceGroupField;
  index: number;
  onUpdateGroup: (groupId: string, values: Partial<MenuChoiceGroupFormValue>) => Promise<void>;
  onDeleteGroup: (groupId: string, index: number) => Promise<void>;
  onReorderGroup: (from: number, to: number) => Promise<void>;
  onCreateOption: (groupId: string, displayOrder: number) => Promise<MenuChoiceOption | null>;
  onUpdateOption: (optionId: string, values: MenuOptionFormValue) => Promise<void>;
  onDeleteOption: (optionId: string) => Promise<boolean>;
  onReorderOption: (
    updates: Array<{ optionId: string; displayOrder: number }>
  ) => Promise<void>;
};

function ChoiceGroupCard({
  form,
  groupField,
  index,
  onUpdateGroup,
  onDeleteGroup,
  onReorderGroup,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  onReorderOption,
}: ChoiceGroupCardProps) {
  const { fields: optionFields, append, remove, move } = useFieldArray({
    control: form.control,
    name: `choiceGroups.${index}.options`,
    keyName: "fieldId",
  });

  const [draggedGroup, setDraggedGroup] = useState<number | null>(null);
  const [draggedOption, setDraggedOption] = useState<number | null>(null);

  const handleGroupDragStart = () => setDraggedGroup(index);
  const handleGroupDragOver = (event: React.DragEvent<HTMLDivElement>) => event.preventDefault();
  const handleGroupDrop = (targetIndex: number) => {
    if (draggedGroup === null || draggedGroup === targetIndex) return;
    void onReorderGroup(draggedGroup, targetIndex);
    setDraggedGroup(null);
  };

  const handleGroupBlur = () => {
    const normalizedId = groupField.id?.trim();
    if (!normalizedId) return;
    const value = form.getValues(`choiceGroups.${index}`);
    void onUpdateGroup(normalizedId, value);
  };

  const handleOptionBlur = (optionIndex: number) => {
    const option = form.getValues(
      `choiceGroups.${index}.options.${optionIndex}`
    );
    const normalizedId = option?.id?.trim();
    if (!normalizedId) return;
    void onUpdateOption(normalizedId, option);
  };

  const handleAddOption = async () => {
    const normalizedId = groupField.id?.trim();
    if (!normalizedId) return;
    const option = await onCreateOption(normalizedId, optionFields.length);
    if (option) {
      append({
        id: option.id,
        nameEn: option.nameEn,
        nameMm: option.nameMm ?? "",
        extraPrice: option.extraPrice ? option.extraPrice.toString() : "0",
        isAvailable: option.isAvailable,
      });
    }
  };

  const handleDeleteOption = async (optionIndex: number) => {
    const option = optionFields[optionIndex];
    const normalizedId = option?.id?.trim();
    if (normalizedId) {
      const success = await onDeleteOption(normalizedId);
      if (!success) return;
    }
    remove(optionIndex);
  };

  const handleOptionDragStart = (optionIndex: number) => {
    setDraggedOption(optionIndex);
  };

  const handleOptionDrop = async (targetIndex: number) => {
    if (draggedOption === null || draggedOption === targetIndex) {
      setDraggedOption(null);
      return;
    }
    const sourceIndex = draggedOption;
    move(sourceIndex, targetIndex);
    const nextOptions = form.getValues(`choiceGroups.${index}.options`);
    const updates = nextOptions
      .map((option, idx) =>
        option.id?.trim()
          ? { optionId: option.id.trim(), displayOrder: idx }
          : null
      )
      .filter((entry): entry is { optionId: string; displayOrder: number } =>
        Boolean(entry)
      );

    try {
      if (updates.length) {
        await onReorderOption(updates);
      }
    } catch {
      // revert on failure
      move(targetIndex, sourceIndex);
    } finally {
      setDraggedOption(null);
    }
  };

  const groupValues = useWatch({
    control: form.control,
    name: `choiceGroups.${index}` as const,
  }) as MenuChoiceGroupFormValue | undefined;

  const summaryTitle = groupValues?.titleEn?.trim() || `Choices section ${index + 1}`;
  const summaryTitleMm = groupValues?.titleMm?.trim();
  const typeLabel = CHOICE_TYPE_LABEL[groupValues?.type ?? "single"];
  const choiceCountLabel = `${optionFields.length} ${optionFields.length === 1 ? "choice" : "choices"}`;
  const requirementLabel = groupValues?.isRequired ? "Required" : "Optional";
  const summaryMeta = `${typeLabel} • ${choiceCountLabel} • ${requirementLabel}`;
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleLabel = isExpanded ? "Close section" : "Open section";

  return (
    <div
      draggable
      onDragStart={handleGroupDragStart}
      onDragOver={handleGroupDragOver}
      onDrop={() => handleGroupDrop(index)}
      className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition hover:border-emerald-300"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{summaryTitle}</p>
          {summaryTitleMm ? (
            <p className="text-xs text-slate-500">{summaryTitleMm}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">{summaryMeta}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className={cn(
              PRIMARY_BUTTON_CLASS,
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            )}
          >
            <span>{toggleLabel}</span>
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform duration-200",
                isExpanded ? "-rotate-180" : "rotate-0"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            className="text-rose-600 hover:text-rose-700"
            type="button"
            onClick={() => {
              const normalizedId = groupField.id?.trim();
              if (!normalizedId) return;
              void onDeleteGroup(normalizedId, index);
            }}
          >
            Delete section
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-6 border-t border-emerald-100 px-6 pb-6 pt-4">
          <div className="grid w-full gap-4 md:grid-cols-12">
            <FieldBlock label="Section title" required className="md:col-span-5 lg:col-span-5">
              <Input
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.titleEn` as const)}
                placeholder="e.g. Choose your protein"
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <FieldBlock
              label="Section title (Burmese)"
              className="md:col-span-4 lg:col-span-4"
            >
              <Input
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.titleMm` as const)}
                placeholder="အမည်"
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <FieldBlock label="Selection style" required className="md:col-span-3 lg:col-span-3">
              <Controller
                control={form.control}
                name={`choiceGroups.${index}.type` as const}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value: MenuChoiceGroupType) => {
                      field.onChange(value);
                      void handleGroupBlur();
                    }}
                  >
                    <SelectTrigger className={cn("w-full", COMPACT_SELECT_TRIGGER_CLASS)}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_CHOICE_GROUP_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {CHOICE_TYPE_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldBlock>
          </div>

          <div className="grid gap-4 md:grid-cols-12">
            <FieldBlock label="Minimum picks" className="md:col-span-4">
              <Input
                type="number"
                min={0}
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.minSelect` as const, {
                  valueAsNumber: true,
                })}
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <FieldBlock label="Maximum picks" required className="md:col-span-4">
              <Input
                type="number"
                min={1}
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.maxSelect` as const, {
                  valueAsNumber: true,
                })}
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <ToggleBlock label="Make this required?" className="md:col-span-4 h-full">
              <Controller
                control={form.control}
                name={`choiceGroups.${index}.isRequired` as const}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      void handleGroupBlur();
                    }}
                    className={SWITCH_TONE_CLASS}
                  />
                )}
              />
            </ToggleBlock>
          </div>

          <div className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Choices in this section
                </h4>
                <p className="text-xs text-emerald-700/80">
                  Drag cards to reorder or toggle availability on the right.
                </p>
              </div>
              <Button
                size="sm"
                type="button"
                onClick={() => void handleAddOption()}
                className={PRIMARY_BUTTON_CLASS}
              >
                Add choice
              </Button>
            </div>

            {optionFields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-emerald-200 bg-white p-5 text-sm text-emerald-700">
                No choices yet. Add portion sizes, toppings, or upgrades for diners to pick.
              </div>
            ) : (
              <div className="space-y-4">
                {optionFields.map((option, optionIndex) => (
                  <div
                    key={option.id ?? option.fieldId}
                    draggable
                    onDragStart={() => handleOptionDragStart(optionIndex)}
                    onDragOver={handleGroupDragOver}
                    onDrop={() => handleOptionDrop(optionIndex)}
                    className="space-y-4 rounded-xl border border-transparent bg-white p-4 shadow-xs transition hover:shadow-sm"
                  >
                    <div className="grid gap-4 md:grid-cols-12">
                      <FieldBlock label="Choice name" required className="md:col-span-4">
                        <Input
                          className={COMPACT_INPUT_CLASS}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.nameEn` as const
                          )}
                          placeholder="e.g. Extra spicy"
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                      <FieldBlock
                        label="Choice name (Burmese)"
                        className="md:col-span-4"
                      >
                        <Input
                          className={COMPACT_INPUT_CLASS}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.nameMm` as const
                          )}
                          placeholder="ရွေးချယ်မှု"
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                      <FieldBlock
                        label="Extra price"
                        className="md:col-span-3 lg:col-span-2"
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cn(COMPACT_INPUT_CLASS, "md:max-w-40")}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.extraPrice` as const
                          )}
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <ToggleBlock
                        label="Show to diners"
                        className="max-w-md border-slate-200 bg-slate-50 md:w-auto"
                      >
                        <Controller
                          control={form.control}
                          name={`choiceGroups.${index}.options.${optionIndex}.isAvailable` as const}
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                void handleOptionBlur(optionIndex);
                              }}
                              className={SWITCH_TONE_CLASS}
                            />
                          )}
                        />
                      </ToggleBlock>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          type="button"
                          onClick={() => void handleDeleteOption(optionIndex)}
                        >
                          Remove choice
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ChoicePoolSummary = {
  id: string;
  nameEn: string;
  nameMm: string | null;
  isActive: boolean;
};

type SetMenuPoolsPanelProps = {
  form: UseFormReturn<MenuEditorFormValues>;
};

function SetMenuPoolsPanel({ form }: SetMenuPoolsPanelProps) {
  const isSetMenu = useWatch({
    control: form.control,
    name: "isSetMenu",
  });
  const poolLinks = (useWatch({
    control: form.control,
    name: "poolLinks",
  }) ?? []) as SetMenuPoolLinkFormValue[];

  const [pools, setPools] = useState<ChoicePoolSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSetMenu) return;

    let cancelled = false;

    fetchJSON<{ pools: ChoicePoolSummary[] }>("/api/admin/menu/pools", {
      method: "GET",
      cache: "no-store",
    })
      .then((data) => {
        if (cancelled) return;
        setPools(data.pools);
      })
      .catch((error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.error(error);
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load choice pools."
        );
      })
      .finally(() => {
        if (!cancelled) {
          // no-op; loading state is derived from pools + error
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSetMenu]);

  if (!isSetMenu) {
    return null;
  }

  const linksByRole = new Map<SetMenuPoolRole, SetMenuPoolLinkFormValue>();
  for (const link of poolLinks) {
    linksByRole.set(link.role, link);
  }

  const handleUpdateLink = (
    role: SetMenuPoolRole,
    updater: (current: SetMenuPoolLinkFormValue) => SetMenuPoolLinkFormValue
  ) => {
    const currentLinks =
      poolLinks.length > 0
        ? poolLinks
        : SET_MENU_ROLES.map((r, index) => buildDefaultPoolLink(r, index));

    const nextLinks = currentLinks.map((link) =>
      link.role === role ? updater(link) : link
    );

    form.setValue("poolLinks", nextLinks, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const isLoading = isSetMenu && pools.length === 0 && !loadError;

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Set menu pools
          </p>
          <p className="text-sm text-slate-700">
            Attach choice pools for the base curry and add-ons. Diners will pick
            from these when building a set.
          </p>
        </div>
        {isLoading ? (
          <span className="text-xs text-slate-500">Loading pools…</span>
        ) : null}
      </div>
      {loadError ? (
        <p className="text-xs text-rose-600">{loadError}</p>
      ) : null}
      {pools.length === 0 ? (
        <p className="text-xs text-slate-600">
          No choice pools found. Create pools under{" "}
          <span className="font-semibold">Admin → Menu → Choice pools</span>{" "}
          first, then attach them here.
        </p>
      ) : (
        <div className="space-y-3">
          {SET_MENU_ROLES.map((role) => {
            const link =
              linksByRole.get(role) ??
              buildDefaultPoolLink(role, SET_MENU_ROLES.indexOf(role));

            return (
              <div
                key={role}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-3 sm:px-4 sm:py-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {SET_MENU_ROLE_LABELS[role]}
                    </p>
                    <p className="text-xs text-slate-500">
                      {SET_MENU_ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                    {role}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">
                      Attached pool
                    </p>
                    <Select
                      value={link.poolId ?? NO_POOL_VALUE}
                      onValueChange={(value) => {
                        const nextPoolId =
                          value === NO_POOL_VALUE ? null : value;
                        handleUpdateLink(role, (current) => ({
                          ...current,
                          poolId: nextPoolId,
                        }));
                      }}
                    >
                      <SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="No pool attached" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_POOL_VALUE}>
                          <span className="text-slate-500">
                            No pool attached
                          </span>
                        </SelectItem>
                        {pools.map((pool) => (
                          <SelectItem key={pool.id} value={pool.id}>
                            <span className="font-medium text-slate-900">
                              {pool.nameEn}
                            </span>
                            {pool.nameMm ? (
                              <span className="ml-1 text-xs text-slate-500">
                                ({pool.nameMm})
                              </span>
                            ) : null}
                            {!pool.isActive && (
                              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                Inactive
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-xs font-medium text-slate-700">
                        Required selection
                      </span>
                      <Switch
                        checked={link.isRequired}
                        onCheckedChange={(checked) =>
                          handleUpdateLink(role, (current) => ({
                            ...current,
                            isRequired: checked,
                          }))
                        }
                        className={SWITCH_TONE_CLASS}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">
                          Min selects
                        </p>
                        <Input
                          type="number"
                          min={0}
                          value={link.minSelect}
                          onChange={(event) => {
                            const value = Number.parseInt(
                              event.target.value,
                              10
                            );
                            const nextMin = Number.isFinite(value)
                              ? value
                              : 0;
                            handleUpdateLink(role, (current) => ({
                              ...current,
                              minSelect: nextMin,
                            }));
                          }}
                          className={COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">
                          Max selects
                        </p>
                        <Input
                          type="number"
                          min={1}
                          value={link.maxSelect}
                          onChange={(event) => {
                            const value = Number.parseInt(
                              event.target.value,
                              10
                            );
                            const nextMax = Number.isFinite(value)
                              ? value
                              : 1;
                            handleUpdateLink(role, (current) => ({
                              ...current,
                              maxSelect: nextMax,
                            }));
                          }}
                          className={COMPACT_INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
