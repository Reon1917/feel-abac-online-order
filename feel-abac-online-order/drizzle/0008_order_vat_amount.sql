ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "vat_amount" numeric(10, 0) DEFAULT '0' NOT NULL;
