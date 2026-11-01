CREATE TABLE guild_interest (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL REFERENCES interest(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, interest_id)
);
CREATE INDEX guild_interest_player ON guild_interest(interest_id);
