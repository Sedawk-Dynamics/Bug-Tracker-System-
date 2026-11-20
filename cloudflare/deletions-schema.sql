CREATE TABLE IF NOT EXISTS deleted_items (
 id TEXT PRIMARY KEY NOT NULL,
 deleted_at TEXT NOT NULL,
 deleted_by TEXT NOT NULL
);
