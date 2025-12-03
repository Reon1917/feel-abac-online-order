-- Add rejection_count column to order_payments for tracking receipt upload attempts
ALTER TABLE "order_payments" ADD COLUMN "rejection_count" integer DEFAULT 0 NOT NULL;

