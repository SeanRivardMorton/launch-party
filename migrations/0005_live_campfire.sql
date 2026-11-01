-- Separate campfire-owned records. Guild IDs are opaque directory IDs until the
-- onboarding/guild implementation supplies its authenticated membership handoff.
-- Only trusted server code / an operator may grant membership; no public join API.
CREATE TABLE campfire_memberships (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX campfire_memberships_user ON campfire_memberships(user_id);
CREATE TABLE campfire_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  faction TEXT NOT NULL CHECK(faction IN ('Alliance', 'Horde')),
  race TEXT NOT NULL,
  character_class TEXT NOT NULL,
  professions TEXT NOT NULL DEFAULT '[]',
  bio TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0, 1)),
  updated_at INTEGER NOT NULL
);
CREATE TABLE campfire_avatars (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'not_requested' CHECK(state IN ('not_requested', 'pending', 'ready', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  token TEXT,
  asset_key TEXT,
  model TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0
);
