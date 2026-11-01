ALTER TABLE guilds ADD COLUMN recruitment_needs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE guilds ADD COLUMN management_key_hash TEXT;
