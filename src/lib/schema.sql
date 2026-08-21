-- Piper CRM schema. Applied by src/lib/db.ts on first connection.
-- SQLite stores dates as 'YYYY-MM-DD' and times as 'HH:MM' (24h) text.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'dj')),
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS venues (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  load_in_notes TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);

CREATE TABLE IF NOT EXISTS events (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  status             TEXT NOT NULL DEFAULT 'tentative'
                     CHECK (status IN ('tentative', 'confirmed', 'completed', 'cancelled')),
  partner_one_name   TEXT NOT NULL,
  partner_two_name   TEXT,
  contact_email      TEXT,
  contact_phone      TEXT,
  event_date         TEXT NOT NULL,
  load_in_time       TEXT,
  ceremony_time      TEXT,
  cocktail_time      TEXT,
  reception_time     TEXT,
  end_time           TEXT,
  venue_id           INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  venue_room         TEXT,
  guest_count        INTEGER,
  package_name       TEXT,
  assigned_dj_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  internal_notes     TEXT,
  plan_token         TEXT NOT NULL UNIQUE,
  plan_submitted_at  TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_dj ON events(assigned_dj_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE TABLE IF NOT EXISTS songs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  title      TEXT NOT NULL,
  artist     TEXT,
  notes      TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'team' CHECK (source IN ('team', 'client')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_songs_event ON songs(event_id, category, position);

CREATE TABLE IF NOT EXISTS timeline_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_time TEXT,
  title      TEXT NOT NULL,
  notes      TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_event ON timeline_items(event_id, position);

-- One row per event, created lazily when the couple opens their planner.
CREATE TABLE IF NOT EXISTS questionnaires (
  event_id          INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  preferred_genres  TEXT,
  avoid_genres      TEXT,
  vibe_notes        TEXT,
  announcements     TEXT,
  wedding_party     TEXT,
  mic_needs         TEXT,
  takes_requests    INTEGER NOT NULL DEFAULT 1,
  contact_on_day    TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
