ALTER TABLE "menu_items"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';

UPDATE "menu_items"
  SET "status" = 'published'
  WHERE "status" IS NULL;

ALTER TABLE "menu_choice_groups"
  ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'single';

UPDATE "menu_choice_groups"
  SET "type" = 'single'
  WHERE "type" IS NULL;
