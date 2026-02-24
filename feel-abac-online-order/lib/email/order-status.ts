import { eq } from "drizzle-orm";

import type { Locale } from "@/lib/i18n/config";
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";

import { sendTransactionalEmail } from "@/lib/email/brevo";
import {
  buildOrderStatusEmail,
  type OrderStatusEmailTemplateKey,
  type OrderEmailDetails,
} from "@/lib/email/templates/order-status";
import type { OrderStatus, RefundStatus, RefundType } from "@/lib/orders/types";

type SendOrderStatusEmailNotificationInput = {
  userId: string | null | undefined;
  displayId: string;
  template: OrderStatusEmailTemplateKey;
  locale?: Locale;
  totalAmount?: string | number | null;
  courierTrackingUrl?: string | null;
  cancelledFromStatus?: OrderStatus | null;
  cancelReason?: string | null;
  refundType?: RefundType | null;
  refundStatus?: RefundStatus | null;
  refundAmount?: string | number | null;
  refundReason?: string | null;
  // Extended order details
  orderDetails?: OrderEmailDetails | null;
};

export async function sendOrderStatusEmailNotification(
  input: SendOrderStatusEmailNotificationInput
) {
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!userId) return;

  const displayId = input.displayId.trim();
  if (!displayId) return;

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const email = user?.email?.trim() ?? "";
  if (!email) return;

  const content = buildOrderStatusEmail(input.template, {
    displayId,
    locale: input.locale,
    totalAmount: input.totalAmount,
    courierTrackingUrl: input.courierTrackingUrl,
    cancelledFromStatus: input.cancelledFromStatus,
    cancelReason: input.cancelReason,
    refundType: input.refundType,
    refundStatus: input.refundStatus,
    refundAmount: input.refundAmount,
    refundReason: input.refundReason,
    orderDetails: input.orderDetails ?? null,
  });

  await sendTransactionalEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
