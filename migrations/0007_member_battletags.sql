CREATE TABLE member_battletags (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  battletag TEXT NOT NULL DEFAULT '' CHECK(length(battletag) <= 64)
);
