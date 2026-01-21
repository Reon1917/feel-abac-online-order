-- Detailed refund tracking for cancelled orders
ALTER TABLE "orders" ADD COLUMN "refund_type" text;
ALTER TABLE "orders" ADD COLUMN "refund_amount" numeric(10, 0);
ALTER TABLE "orders" ADD COLUMN "refund_reason" text;
ALTER TABLE "orders" ADD COLUMN "refund_processed_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN "refund_processed_by_admin_id" text REFERENCES "admins"("id") ON DELETE SET NULL;
