-- Speed up admin verified-payments grouped lookup by indexing verified rows per order.
CREATE INDEX IF NOT EXISTS "order_payments_verified_order_id_idx"
ON "order_payments" ("order_id")
WHERE "status" = 'verified';
