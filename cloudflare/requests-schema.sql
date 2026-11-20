CREATE TABLE IF NOT EXISTS access_requests (
 email TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 requested_at TEXT NOT NULL,
 reviewed_at TEXT,
 reviewed_by TEXT
);
