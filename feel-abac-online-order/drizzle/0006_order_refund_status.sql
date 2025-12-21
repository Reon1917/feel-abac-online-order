-- Track refund record-keeping status for cancelled orders
ALTER TABLE "orders" ADD COLUMN "refund_status" text;
