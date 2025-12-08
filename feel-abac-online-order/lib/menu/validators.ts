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
const menuCodeField = z
  .union([
    z
      .string()
      .trim()
      .min(1, "Menu code cannot be empty")
      .max(32, "Menu code must be 32 characters or fewer"),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

export const menuItemSchema = z.object({
  categoryId: z.uuid("Category ID must be a valid UUID"),
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
  menuCode: menuCodeField,
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
  isSetMenu: z.coerce.boolean().optional(),
  allowUserNotes: z.coerce.boolean().optional(),
  hasImage: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  status: menuItemStatusEnum.default("draft"),
});

export const menuItemUpdateSchema = z.object({
  categoryId: z.uuid("Category ID must be a valid UUID").optional(),
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
  menuCode: menuCodeField,
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
  isSetMenu: z.coerce.boolean().optional(),
  allowUserNotes: z.coerce.boolean().optional(),
  hasImage: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
  status: menuItemStatusEnum.optional(),
  // Pool links for set menus (optional, synced separately)
  poolLinks: z.array(z.object({
    poolId: z.uuid("Pool ID is required"),
    isPriceDetermining: z.coerce.boolean().optional(),
    usesOptionPrice: z.coerce.boolean().optional(),
    flatPrice: z.coerce.number().min(0).optional().nullable(),
    isRequired: z.coerce.boolean().optional(),
    minSelect: z.coerce.number().int().min(0).optional(),
    maxSelect: z.coerce.number().int().min(1).optional(),
    labelEn: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
    labelMm: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
    displayOrder: z.coerce.number().int().gte(0).optional(),
  })).optional(),
});

export const menuChoiceGroupSchema = z
  .object({
    menuItemId: z.uuid("Menu item ID is required"),
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
  })
  .superRefine((data, ctx) => {
    if (data.minSelect > data.maxSelect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum selections cannot exceed maximum selections",
        path: ["minSelect"],
      });
    }
  });

export const menuChoiceGroupUpdateSchema = z.object({
  menuItemId: z.uuid("Menu item ID is required").optional(),
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
  choiceGroupId: z.uuid("Choice group ID is required"),
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
  choiceGroupId: z.uuid("Choice group ID is required").optional(),
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

const reorderEntrySchema = z.object({
  id: z.string().uuid(),
  displayOrder: z.number().int().min(0, "Display order cannot be negative"),
});

export const menuReorderSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("categories"),
    categories: z
      .array(reorderEntrySchema)
      .min(2, "Provide at least two categories to reorder"),
  }),
  z.object({
    mode: z.literal("items"),
    categoryId: z.string().uuid(),
    items: z
      .array(reorderEntrySchema)
      .min(2, "Provide at least two items to reorder"),
  }),
]);

export type MenuReorderPayload = z.infer<typeof menuReorderSchema>;

const badgeLabelField = z
  .string()
  .trim()
  .min(1, "Badge label cannot be empty")
  .max(40, "Badge label must be 40 characters or fewer")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const recommendedMenuItemSchema = z.object({
  menuItemId: z.string().uuid("Menu item ID is required"),
  badgeLabel: badgeLabelField,
});

export const recommendedMenuItemUpdateSchema = z.object({
  badgeLabel: badgeLabelField,
});

export const recommendedMenuReorderSchema = z.object({
  items: z
    .array(reorderEntrySchema)
    .min(2, "Provide at least two recommendations to reorder"),
});

export type RecommendedMenuReorderPayload = z.infer<
  typeof recommendedMenuReorderSchema
>;

export function toDecimalString(value: number) {
  return value.toFixed(2);
}

// ===== CHOICE POOL VALIDATORS =====

export const choicePoolSchema = z.object({
  nameEn: z.string().trim().min(1, "English name is required"),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isActive: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export const choicePoolUpdateSchema = choicePoolSchema.partial();

export const choicePoolOptionSchema = z.object({
  poolId: z.uuid("Pool ID is required"),
  menuCode: z
    .string()
    .trim()
    .max(32, "Menu code must be 32 characters or fewer")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nameEn: z.string().trim().min(1, "English name is required"),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Price must be a number",
    })
    .min(0, "Price cannot be negative")
    .default(0),
  isAvailable: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export const choicePoolOptionUpdateSchema = z.object({
  menuCode: z
    .string()
    .trim()
    .max(32, "Menu code must be 32 characters or fewer")
    .optional()
    .or(z.literal("").transform(() => null)),
  nameEn: z.string().trim().min(1, "English name is required").optional(),
  nameMm: z
    .string()
    .trim()
    .min(1, "Burmese name cannot be empty")
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
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export const setMenuPoolLinkSchema = z.object({
  poolId: z.uuid("Pool ID is required"),
  isPriceDetermining: z.coerce.boolean().optional(),
  usesOptionPrice: z.coerce.boolean().optional(),
  flatPrice: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Flat price must be a number",
    })
    .min(0, "Flat price cannot be negative")
    .optional()
    .nullable(),
  isRequired: z.coerce.boolean().optional(),
  minSelect: z.coerce.number().int().min(0).optional(),
  maxSelect: z.coerce.number().int().min(1).optional(),
  labelEn: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  labelMm: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  displayOrder: z.coerce.number().int().gte(0).optional(),
});

export const setMenuPoolLinksArraySchema = z
  .array(setMenuPoolLinkSchema)
  .superRefine((links, ctx) => {
    const priceDeterminers = links
      .map((link, index) => ({ link, index }))
      .filter(({ link }) => link.isPriceDetermining);

    if (priceDeterminers.length > 1) {
      priceDeterminers.forEach(({ index }) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only one pool can set the base price",
          path: [index, "isPriceDetermining"],
        });
      });
    }

    links.forEach((link, index) => {
      if (link.isPriceDetermining) {
        if (link.isRequired === false) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Base pool must be required",
            path: [index, "isRequired"],
          });
        }
        const minSelect = link.minSelect ?? 1;
        if (minSelect < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Base pool must require at least one selection",
            path: [index, "minSelect"],
          });
        }
      }

      if (
        link.minSelect !== undefined &&
        link.maxSelect !== undefined &&
        link.minSelect > link.maxSelect
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Minimum selections cannot exceed maximum selections",
          path: [index, "minSelect"],
        });
      }
    });
  });

export const poolReorderSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1, "At least one ID is required"),
});

export type SetMenuPoolLinkPayload = z.infer<typeof setMenuPoolLinkSchema>;
