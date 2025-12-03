import { createUploadthing, type FileRouter } from "uploadthing/next";

import { resolveUserId } from "@/lib/api/require-user";

const f = createUploadthing();

export const uploadRouter = {
  paymentReceipt: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const userId = await resolveUserId(req);
      if (!userId) throw new Error("Unauthorized");

      const orderId = req.headers.get("x-order-id");
      const paymentType = req.headers.get("x-payment-type") || "food";

      if (!orderId) throw new Error("Missing order ID");

      return { userId, orderId, paymentType };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url: file.ufsUrl,
        orderId: metadata.orderId,
        paymentType: metadata.paymentType,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

