CREATE TABLE IF NOT EXISTS custom_items (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('problems', 'flows', 'untested', 'deliverables')),
 payload TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);
