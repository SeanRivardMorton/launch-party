-- Existing single-frame images remain valid until explicitly regenerated.
ALTER TABLE campfire_avatars ADD COLUMN asset_format TEXT NOT NULL DEFAULT 'single'
  CHECK(asset_format IN ('single', 'codex-pet-v1'));
ALTER TABLE campfire_avatars ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campfire_avatars ADD COLUMN total_steps INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campfire_avatars ADD COLUMN error_code TEXT;
ALTER TABLE campfire_avatars ADD COLUMN asset_revision INTEGER NOT NULL DEFAULT 0;
