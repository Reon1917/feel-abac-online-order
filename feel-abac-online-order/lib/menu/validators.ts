import { z } from "zod";

export const MAX_MENU_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB upper limit
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MENU_ITEM_STATUSES = ["draft", "published"] as const;
export const MENU_CHOICE_GROUP_TYPES = [
  "single",
  "multi",
  "toggle",
  "dropdown",
  "quantity",
] as const;

export const menuCategorySchema = z.object({
  nameEn: z.string().trim().min(1, "English name is required"),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const menuCategoryUpdateSchema = menuCategorySchema.partial();

const menuItemStatusEnum = z.enum(MENU_ITEM_STATUSES);
const menuChoiceGroupTypeEnum = z.enum(MENU_CHOICE_GROUP_TYPES);

export const menuItemSchema = z.object({
  categoryId: z.string().uuid("Category ID must be a valid UUID"),
  nameEn: z.string().trim().min(1, "English name is required"),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  descriptionEn: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  descriptionMm: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  placeholderIcon: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  imageUrl: z
    .string()
    .url("Image URL must be valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Price must be a number",
    })
    .min(0, "Price cannot be negative"),
  isAvailable: z.coerce.boolean().optional(),
  allowUserNotes: z.coerce.boolean().optional(),
  hasImage: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  status: menuItemStatusEnum.default("draft"),
});

export const menuItemUpdateSchema = z.object({
  categoryId: z.string().uuid("Category ID must be a valid UUID").optional(),
  nameEn: z.string().trim().min(1, "English name is required").optional(),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  descriptionEn: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  descriptionMm: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  placeholderIcon: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  imageUrl: z
    .string()
    .url("Image URL must be valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Price must be a number",
    })
    .min(0, "Price cannot be negative")
    .optional(),
  isAvailable: z.coerce.boolean().optional(),
  allowUserNotes: z.coerce.boolean().optional(),
  hasImage: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  status: menuItemStatusEnum.optional(),
});

export const menuChoiceGroupSchema = z.object({
  menuItemId: z.string().uuid("Menu item ID is required"),
  titleEn: z.string().trim().min(1, "English title is required"),
  titleMm: z
    .string()
    .trim()
    .min(1, "Burmese title cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  minSelect: z.coerce
    .number()
    .int()
    .min(0, "Minimum selections cannot be negative")
    .default(0),
  maxSelect: z.coerce
    .number()
    .int()
    .min(1, "Maximum selections must be at least 1"),
  isRequired: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  type: menuChoiceGroupTypeEnum.default("single"),
});

export const menuChoiceGroupUpdateSchema = z.object({
  menuItemId: z.string().uuid("Menu item ID is required").optional(),
  titleEn: z.string().trim().min(1, "English title is required").optional(),
  titleMm: z
    .string()
    .trim()
    .min(1, "Burmese title cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  minSelect: z.coerce
    .number()
    .int()
    .min(0, "Minimum selections cannot be negative")
    .optional(),
  maxSelect: z.coerce
    .number()
    .int()
    .min(1, "Maximum selections must be at least 1")
    .optional(),
  isRequired: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  type: menuChoiceGroupTypeEnum.optional(),
});

export const menuChoiceOptionSchema = z.object({
  choiceGroupId: z.string().uuid("Choice group ID is required"),
  nameEn: z.string().trim().min(1, "English name is required"),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  extraPrice: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Extra price must be a number",
    })
    .min(0, "Extra price cannot be negative")
    .default(0),
  isAvailable: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export const menuChoiceOptionUpdateSchema = z.object({
  choiceGroupId: z.string().uuid("Choice group ID is required").optional(),
  nameEn: z.string().trim().min(1, "English name is required").optional(),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  extraPrice: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Extra price must be a number",
    })
    .min(0, "Extra price cannot be negative")
    .optional(),
  isAvailable: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export function toDecimalString(value: number) {
  return value.toFixed(2);
}
