import { z } from "zod";

export const deliveryBuildingLabelSchema = z
  .string()
  .trim()
  .min(1, "Building label is required")
  .max(60, "Building label is too long");

export const createDeliveryLocationSchema = z
  .object({
    condoName: z
      .string()
      .trim()
      .min(2, "Condo name must be at least 2 characters")
      .max(120, "Condo name is too long"),
    minFee: z.number().int().nonnegative("Minimum fee must be positive"),
    maxFee: z.number().int().nonnegative("Maximum fee must be positive"),
    notes: z
      .string()
      .trim()
      .max(200, "Notes are too long")
      .optional()
      .nullable(),
    buildings: z.array(deliveryBuildingLabelSchema).max(20, "Too many buildings").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.maxFee < value.minFee) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum fee must be greater than or equal to minimum fee",
        path: ["maxFee"],
      });
    }
  });

export type CreateDeliveryLocationInput = z.infer<typeof createDeliveryLocationSchema>;
