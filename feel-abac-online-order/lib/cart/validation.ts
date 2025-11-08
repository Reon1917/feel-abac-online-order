import { z } from "zod";

import { MAX_QUANTITY_PER_LINE } from "./types";

const selectionSchema = z.object({
  groupId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).max(20),
});

export const addToCartSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  note: z
    .string()
    .trim()
    .max(280, "Notes should be 280 characters or fewer")
    .optional()
    .nullable(),
  selections: z.array(selectionSchema).max(25).default([]),
});

export type AddToCartPayload = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
});
