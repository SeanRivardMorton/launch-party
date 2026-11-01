ALTER TABLE guilds ADD COLUMN owner_user_id TEXT REFERENCES user(id);

CREATE TABLE guild_memberships (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('leader', 'officer', 'member')),
  profile TEXT NOT NULL CHECK(json_valid(profile)),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX guild_memberships_user ON guild_memberships(user_id);
CREATE UNIQUE INDEX guild_single_leader ON guild_memberships(guild_id) WHERE role = 'leader';

CREATE TABLE guild_applications (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  profile TEXT NOT NULL CHECK(json_valid(profile)),
  introduction TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX guild_applications_pending ON guild_applications(guild_id, status, created_at);

CREATE TABLE guild_initiatives (
  id TEXT PRIMARY KEY NOT NULL,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'completed')),
  created_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX guild_initiatives_guild ON guild_initiatives(guild_id, created_at);
