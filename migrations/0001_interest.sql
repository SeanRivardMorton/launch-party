CREATE TABLE IF NOT EXISTS interest (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Tank', 'Healer', 'Damage', 'Undecided')),
  need TEXT NOT NULL,
  feedback TEXT NOT NULL DEFAULT '',
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
