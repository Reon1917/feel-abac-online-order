CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
  "session_token" text,
  "status" text NOT NULL DEFAULT 'active',
  "subtotal" numeric(10, 2) NOT NULL DEFAULT 0,
  "last_activity_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cart_id" uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "menu_item_name" text NOT NULL,
  "menu_item_name_mm" text,
  "base_price" numeric(10, 2) NOT NULL,
  "addons_total" numeric(10, 2) NOT NULL DEFAULT 0,
  "quantity" integer NOT NULL DEFAULT 1,
  "note" text,
  "hash_key" text NOT NULL,
  "total_price" numeric(10, 2) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cart_item_choices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cart_item_id" uuid NOT NULL REFERENCES "cart_items"("id") ON DELETE CASCADE,
  "group_name" text NOT NULL,
  "group_name_mm" text,
  "option_name" text NOT NULL,
  "option_name_mm" text,
  "extra_price" numeric(10, 2) NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "carts_user_id_idx" ON "carts" ("user_id");
CREATE INDEX IF NOT EXISTS "carts_session_token_idx" ON "carts" ("session_token");
CREATE UNIQUE INDEX IF NOT EXISTS "carts_active_user_id_idx"
  ON "carts" ("user_id")
  WHERE "status" = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS "carts_active_session_token_idx"
  ON "carts" ("session_token")
  WHERE "status" = 'active' AND "session_token" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_hash_unique" ON "cart_items" ("cart_id", "hash_key");
