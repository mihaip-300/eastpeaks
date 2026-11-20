-- Affiliate clicks (HANDOFF 8.2). No IP and no full user agent are stored.
CREATE TABLE clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  partner TEXT NOT NULL,
  target TEXT NOT NULL,
  page TEXT,
  country TEXT,
  device TEXT
);
CREATE INDEX idx_clicks_ts ON clicks (ts);
CREATE INDEX idx_clicks_page ON clicks (page);
