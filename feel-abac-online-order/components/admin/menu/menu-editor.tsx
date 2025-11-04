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
  allowUserNotes: boolean;
  status: MenuItemStatus;
  choiceGroups: MenuChoiceGroupFormValue[];
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
      allowUserNotes: false,
      status: "draft",
      choiceGroups: [],
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
    allowUserNotes: item.allowUserNotes,
    status: item.status,
    choiceGroups: item.choiceGroups.map((group) => ({
      id: group.id,
      titleEn: group.titleEn,
      titleMm: group.titleMm ?? "",
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      isRequired: group.isRequired,
      type: group.type,
      options: group.options.map((option) => ({
        id: option.id,
        nameEn: option.nameEn,
        nameMm: option.nameMm ?? "",
        extraPrice: option.extraPrice ? option.extraPrice.toString() : "0",
        isAvailable: option.isAvailable,
      })),
    })),
  };
}

type ChoiceGroupField = MenuChoiceGroupFormValue & { fieldId: string };

export function MenuEditor({ refreshMenu, onDirtyChange }: MenuEditorProps) {
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
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    form.reset(itemToFormValues(selectedItem, selectedCategory?.id ?? null));
    setAutosaveError(null);
    setLastSavedAt(null);
  }, [selectedItem, selectedCategory?.id, form]);

  const persistItemDraft = useCallback(
    async (values: MenuEditorFormValues) => {
      if (!selectedItem) {
        setIsAutosaving(false);
        return;
      }

      const payload: Record<string, unknown> = {};

      if (values.nameEn?.trim()) {
        payload.nameEn = values.nameEn.trim();
      }
      if (values.nameMm !== undefined) {
        payload.nameMm = values.nameMm?.trim() || undefined;
      }
      if (values.descriptionEn !== undefined) {
        payload.descriptionEn = values.descriptionEn?.trim() || undefined;
      }
      if (values.descriptionMm !== undefined) {
        payload.descriptionMm = values.descriptionMm?.trim() || undefined;
      }
      if (values.placeholderIcon !== undefined) {
        payload.placeholderIcon = values.placeholderIcon?.trim() || undefined;
      }
      if (values.menuCode !== undefined) {
        const trimmedCode = values.menuCode.trim();
        const normalizedCode = trimmedCode.length ? trimmedCode : "";
        const existingCode = selectedItem.menuCode?.trim() ?? "";
        if (normalizedCode !== existingCode) {
          payload.menuCode = normalizedCode;
        }
      }

      if (values.price?.trim()) {
        const parsedPrice = Number.parseFloat(values.price);
        if (!Number.isNaN(parsedPrice) && parsedPrice >= 0) {
          payload.price = parsedPrice;
        }
      }

      payload.isAvailable = values.isAvailable;
      payload.allowUserNotes = values.allowUserNotes;
      payload.status = values.status;

      if (Object.keys(payload).length === 0) {
        setIsAutosaving(false);
        return;
      }

      try {
        const itemId = selectedItem.id?.trim();
        if (!itemId) {
          throw new Error("Invalid menu item ID");
        }

        const { item } = await fetchJSON<{ item: MenuItemRecord }>(
          `/api/admin/menu/items/${itemId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify(payload),
          }
        );

        updateItem({
          itemId: item.id,
          categoryId: item.categoryId,
          updates: item,
        });

        setLastSavedAt(new Date());
        form.reset(
          {
            ...values,
            menuCode: item.menuCode ?? "",
            price:
              payload.price !== undefined
                ? String(payload.price)
                : values.price,
            status: item.status,
          },
          {
            keepValues: true,
            keepDefaultValues: false,
            keepDirty: false,
            keepTouched: true,
            keepErrors: true,
          }
        );
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Failed to autosave draft";
        setAutosaveError(message);
        toast.error(message);
      } finally {
        setIsAutosaving(false);
      }
    },
    [form, selectedItem, updateItem]
  );

  const watchedValues =
    (useWatch<MenuEditorFormValues>({ control: form.control }) ??
      form.getValues()) as MenuEditorFormValues;
  const watchedChoiceGroups = watchedValues.choiceGroups ?? [];
  const currentStatus = watchedValues.status ?? "draft";

  useEffect(() => {
    const subscription = form.watch((values, info) => {
      if (!selectedItem || !info?.name) return;
      if (info.name.startsWith("choiceGroups")) {
        return;
      }

      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
      setIsAutosaving(true);
      setAutosaveError(null);
      autosaveTimer.current = setTimeout(() => {
        void persistItemDraft(values as MenuEditorFormValues);
      }, 750);
    });

    return () => subscription.unsubscribe();
  }, [form, persistItemDraft, selectedItem]);

  useEffect(() => {
    onDirtyChange(
      isAutosaving || form.formState.isDirty || isChoiceMutating
    );
  }, [isAutosaving, form.formState.isDirty, isChoiceMutating, onDirtyChange]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty || isAutosaving || isChoiceMutating) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty, isAutosaving, isChoiceMutating]);

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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
      console.error(error);
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
        console.error(error);
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
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Image upload failed"
        );
      }
    },
    [refreshMenu, selectedCategory?.id, selectedItem]
  );

  const handleImageDelete = useCallback(async () => {
    if (!selectedItem) return;
    const menuItemId = selectedItem.id?.trim();
    if (!menuItemId) {
      toast.error("Menu item is missing an ID.");
      return;
    }
    try {
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
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete image"
      );
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
      setIsAutosaving(true);
      try {
        const { item } = await fetchJSON<{ item: MenuItemRecord }>(
          `/api/admin/menu/items/${itemId}`,
          {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify({ status }),
          }
        );
        updateItem({
          itemId: item.id,
          categoryId: item.categoryId,
          updates: item,
        });
        form.reset(
          {
            ...form.getValues(),
            status: item.status,
          },
          {
            keepValues: true,
            keepDirty: false,
            keepTouched: true,
            keepErrors: true,
          }
        );
        setLastSavedAt(new Date());
        toast.success(
          status === "published"
            ? "Menu item published"
            : "Menu item saved as draft"
        );
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Failed to update item";
        setAutosaveError(message);
        toast.error(message);
      } finally {
        setIsAutosaving(false);
      }
    },
    [form, selectedItem, updateItem]
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
      console.error(error);
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
              <FieldBlock label="Name (English)" required>
                <Input
                  {...form.register("nameEn")}
                  placeholder="e.g. Grilled chicken bowl"
                />
              </FieldBlock>
              <FieldBlock label="Name (Burmese)">
                <Input
                  {...form.register("nameMm")}
                  placeholder="မြန်မာလို အမည်"
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldBlock label="Price" description="Enter numbers only" required>
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
              >
                <Input
                  {...form.register("menuCode")}
                  placeholder="e.g. A-12"
                  maxLength={32}
                />
              </FieldBlock>
              <FieldBlock label="Placeholder icon" description="Optional emoji or letters">
                <Input
                  {...form.register("placeholderIcon")}
                  maxLength={4}
                  placeholder="🍜"
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Descriptions"
            description="Tell diners what makes this item special in both languages."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label="Description (English)">
                <Textarea
                  {...form.register("descriptionEn")}
                  rows={3}
                  placeholder="Share ingredients or tasting notes."
                />
              </FieldBlock>
              <FieldBlock label="Description (Burmese)">
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
                label="Visible to diners"
                description="Hide temporarily while you polish the item."
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
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                disabled={isAutosaving}
                className={cn(getStatusButtonClass(currentStatus === "draft"), "transition-colors")}
              >
                Save as draft
              </Button>
              <Button
                variant="outline"
                className={cn(getStatusButtonClass(currentStatus === "published"), "transition-colors")}
                type="button"
                onClick={() => setStatus("published")}
                disabled={isAutosaving}
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
              onClick={() => imageInputRef.current?.click()}
            >
              Upload image
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
                onClick={() => void handleImageDelete()}
              >
                Remove current image
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
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
};

function FieldBlock({ label, required, description, children }: FieldBlockProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
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

function ToggleBlock({ label, description, children, className }: ToggleBlockProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-800 md:whitespace-nowrap">{label}</p>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
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
                  placeholder="မြန်မာလို အမည်"
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
          <div className="grid w-full gap-4 md:grid-cols-3">
            <FieldBlock label="Section title" required>
              <Input
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.titleEn` as const)}
                placeholder="e.g. Choose your protein"
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <FieldBlock label="Section title (Burmese)">
              <Input
                className={COMPACT_INPUT_CLASS}
                {...form.register(`choiceGroups.${index}.titleMm` as const)}
                placeholder="မြန်မာလို အခန်း"
                onBlur={handleGroupBlur}
              />
            </FieldBlock>
            <FieldBlock label="Selection style" required>
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

          <div className="grid gap-4 md:grid-cols-3">
            <FieldBlock label="Minimum picks">
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
            <FieldBlock label="Maximum picks" required>
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
            <ToggleBlock label="Make this required?">
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
                    <div className="grid gap-4 md:grid-cols-4">
                      <FieldBlock label="Choice name" required>
                        <Input
                          className={COMPACT_INPUT_CLASS}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.nameEn` as const
                          )}
                          placeholder="e.g. Extra spicy"
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                      <FieldBlock label="Choice name (Burmese)">
                        <Input
                          className={COMPACT_INPUT_CLASS}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.nameMm` as const
                          )}
                          placeholder="မြန်မာလို ရွေးချယ်မှု"
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                      <FieldBlock label="Extra price (optional)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className={COMPACT_INPUT_CLASS}
                          {...form.register(
                            `choiceGroups.${index}.options.${optionIndex}.extraPrice` as const
                          )}
                          onBlur={() => handleOptionBlur(optionIndex)}
                        />
                      </FieldBlock>
                      <ToggleBlock label="Show to diners">
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
                    </div>
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
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
