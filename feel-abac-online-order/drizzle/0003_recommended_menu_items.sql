CREATE TABLE IF NOT EXISTS "recommended_menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "menu_category_id" uuid NOT NULL REFERENCES "menu_categories"("id") ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "badge_label" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "recommended_menu_items_item_unique"
  ON "recommended_menu_items" ("menu_item_id");
