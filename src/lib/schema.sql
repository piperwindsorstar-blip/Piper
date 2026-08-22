-- Piper CRM schema. Applied by src/lib/db.ts on first connection.
-- SQLite stores dates as 'YYYY-MM-DD' and times as 'HH:MM' (24h) text.

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name              TEXT NOT NULL,
  phone             TEXT,
  role              TEXT NOT NULL CHECK (role IN ('admin', 'dj')),
  password_hash     TEXT NOT NULL,
  active            INTEGER NOT NULL DEFAULT 1,
  -- Staff record. Everything below is optional and admin-maintained.
  emergency_contact TEXT,
  start_date        TEXT,
  gear              TEXT,
  staff_notes       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
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
  job_number         TEXT,
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
  -- "start at 1:28", "fade out ~1:50" — the difference between a clean
  -- first dance and the DJ guessing.
  cue        TEXT,
  link       TEXT,
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
  request_policy    TEXT,
  contact_on_day    TEXT,
  dedications       TEXT,
  last_name_taken   TEXT,
  arrival_time      TEXT,
  mc_name           TEXT,
  bridesmaids       TEXT,
  groomsmen         TEXT,
  venue_phone       TEXT,
  coordinator_email TEXT,
  table_reserved    TEXT,
  space_reserved    TEXT,
  power_each_space  TEXT,
  outdoor_portions  TEXT,
  uplight_colours   TEXT,
  photobooth_hours  TEXT,
  playlist_pre_ceremony TEXT,
  playlist_cocktail     TEXT,
  playlist_dinner       TEXT,
  playlist_dance        TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The grand-entrance running order: which position, and who walks in it.
CREATE TABLE IF NOT EXISTS entrance_order (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  role     TEXT NOT NULL,
  names    TEXT
);
CREATE INDEX IF NOT EXISTS idx_entrance_event ON entrance_order(event_id, position);

-- Speeches, each with the walk-up song the speaker enters to.
CREATE TABLE IF NOT EXISTS speeches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  who          TEXT NOT NULL,
  when_text    TEXT,
  song_title   TEXT,
  song_artist  TEXT,
  song_cue     TEXT
);
CREATE INDEX IF NOT EXISTS idx_speeches_event ON speeches(event_id, position);

-- What past couples picked for each slot, compiled from planning forms.
-- Aggregate only: no couple is identifiable from this table.
CREATE TABLE IF NOT EXISTS recommendations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT NOT NULL,
  title        TEXT NOT NULL,
  artist       TEXT,
  times_picked INTEGER NOT NULL DEFAULT 1,
  note         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reco_unique ON recommendations(category, title, COALESCE(artist, ''));

-- ---------------------------------------------------------------- crew reports
-- Post-job reports emailed in by crew (who are not Piper users), imported and
-- matched to each other by job number. A report may or may not correspond to a
-- wedding in `events` — matching is report-to-report, by job_norm.

CREATE TABLE IF NOT EXISTS crew_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('dj', 'warehouse')),
  report_type   TEXT,                        -- 'DJ/Photobooth', 'Event Production', 'Warehouse'
  job_raw       TEXT NOT NULL,               -- exactly as typed on the form
  job_norm      TEXT NOT NULL,               -- canonical YY + NNNN, see normalizeJob
  crew_raw      TEXT,                        -- free text as submitted
  sent_at       TEXT NOT NULL,               -- UTC, 'YYYY-MM-DDTHH:MM:SSZ'
  vdp           TEXT,                        -- video dance party, DJ reports
  rating_client INTEGER,
  rating_crowd  INTEGER,
  rating_staff  INTEGER,
  quality       INTEGER,                     -- warehouse return quality 1-5
  manifest      TEXT CHECK (manifest IN ('yes', 'no', 'na')),
  manifest_override TEXT CHECK (manifest_override IN ('yes', 'no')),
  notes         TEXT,
  is_test       INTEGER NOT NULL DEFAULT 0,
  source_id     TEXT,                        -- Gmail message id, when known
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One report per kind per job per send time: re-importing the same email is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_dedupe ON crew_reports(kind, job_norm, sent_at);
CREATE INDEX IF NOT EXISTS idx_reports_job ON crew_reports(job_norm);
CREATE INDEX IF NOT EXISTS idx_reports_sent ON crew_reports(sent_at);

-- Crew write their names freely; aliases fold spellings together. Grouping is
-- case-insensitive by default, so this is only for the harder merges.
CREATE TABLE IF NOT EXISTS crew_aliases (
  alias      TEXT PRIMARY KEY COLLATE NOCASE,
  canonical  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Who changed what on a booking. Rows outlive the event they describe — the
-- most useful question an audit trail answers is "who deleted this?" — so
-- there is no foreign key onto events, and event_label carries enough to read
-- a deleted booking's history.
CREATE TABLE IF NOT EXISTS event_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL,
  event_label   TEXT NOT NULL,             -- couple and date, as at the time
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_label   TEXT NOT NULL,             -- name as at the time, or 'The couple'
  action        TEXT NOT NULL CHECK (action IN
                  ('created', 'updated', 'deleted', 'plan_link_rotated', 'plan_submitted')),
  field         TEXT,                      -- set only on 'updated'
  old_value     TEXT,                      -- display text, not raw ids
  new_value     TEXT,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_event ON event_audit(event_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_at ON event_audit(at DESC);
