-- Add delivery selection fields to user_profiles for preset/custom persistence
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS delivery_selection_mode text,
  ADD COLUMN IF NOT EXISTS custom_condo_name text,
  ADD COLUMN IF NOT EXISTS custom_building_name text,
  ADD COLUMN IF NOT EXISTS custom_place_id text,
  ADD COLUMN IF NOT EXISTS custom_lat numeric(10, 6),
  ADD COLUMN IF NOT EXISTS custom_lng numeric(10, 6),
  ADD COLUMN IF NOT EXISTS custom_updated_at timestamp;
