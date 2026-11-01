ALTER TABLE interest ADD COLUMN faction TEXT CHECK(faction IN ('Alliance', 'Horde'));
ALTER TABLE interest ADD COLUMN race TEXT;
ALTER TABLE interest ADD COLUMN character_class TEXT;
ALTER TABLE interest ADD COLUMN fulfilled_roles TEXT NOT NULL DEFAULT '[]';
ALTER TABLE interest ADD COLUMN professions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE interest ADD COLUMN guild_intent TEXT CHECK(guild_intent IN ('find', 'list', 'later'));

CREATE TABLE guilds (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  faction TEXT NOT NULL CHECK(faction IN ('Alliance', 'Horde')),
  region TEXT NOT NULL,
  realm TEXT NOT NULL,
  description TEXT NOT NULL,
  join_url TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX guilds_faction_created ON guilds(faction, created_at DESC);
