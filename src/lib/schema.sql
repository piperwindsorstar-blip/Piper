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
  venue_raw     TEXT,                        -- venue as the crew typed it
  venue_id      INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_venue ON crew_reports(venue_id);

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

-- Mail Piper has written but not necessarily sent. Nothing leaves the server
-- until an admin approves it, so a typo'd address or a test booking cannot
-- reach a real client before anyone notices.
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,          -- planner_invite | dj_intro | availability_request
  to_addr     TEXT NOT NULL,
  cc_addr     TEXT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,          -- plain text; wrapped in simple HTML on send
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  queued_at   TEXT NOT NULL,
  sent_at     TEXT,
  error       TEXT,                   -- why the last send attempt failed
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_event ON outbox(event_id);

-- Asking a DJ whether they can work a date. They answer from a link in the
-- email or from inside the app; the token lets them answer without logging in.
CREATE TABLE IF NOT EXISTS availability_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dj_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'asked'
                 CHECK (status IN ('asked', 'available', 'unavailable')),
  note         TEXT,                  -- what the DJ said when answering
  asked_at     TEXT NOT NULL,
  responded_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_avail_once ON availability_requests(event_id, dj_id);
CREATE INDEX IF NOT EXISTS idx_avail_event ON availability_requests(event_id);

-- Crews type a venue name freely into the report form, so it arrives as text
-- and gets matched to a venue record. venue_id is the match; venue_raw is what
-- they actually typed, kept so an unmatched name is still visible and fixable.
-- (crew_reports.venue_raw / venue_id are declared in the table above.)

-- Where you tell Piper that a name crews use is a venue you already have.
-- Same idea as crew_aliases: matching is case-insensitive by default, so this
-- is only for the harder cases — "the barn", "Grand Oak", "Tanaka's place".
CREATE TABLE IF NOT EXISTS venue_aliases (
  alias      TEXT PRIMARY KEY COLLATE NOCASE,
  venue_id   INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_venue_alias_venue ON venue_aliases(venue_id);

-- Every attempt to sign in, successful or not. Answers two different
-- questions: when a staff member was last working (the successes), and whether
-- anyone is trying doors that aren't theirs (the failures).
--
-- Failures keep the email that was typed but never the password, and no row
-- here ever records what a person did once inside — that lives in the audit
-- tables. The IP is kept because a run of failures from one address is the
-- signal worth seeing; it is admin-only, like everything else here.
CREATE TABLE IF NOT EXISTS sign_ins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email_tried TEXT NOT NULL,
  actor_label TEXT NOT NULL,             -- name as at the time, else the email
  outcome     TEXT NOT NULL CHECK (outcome IN ('success', 'failed')),
  reason      TEXT,                      -- set only on a failure
  ip          TEXT,
  user_agent  TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signins_at ON sign_ins(at DESC);
CREATE INDEX IF NOT EXISTS idx_signins_user ON sign_ins(user_id, at DESC);

-- Changes to everything that isn't a booking: staff records, venues, settings.
-- Same shape and same rules as event_audit — display text rather than ids, and
-- no cascade, so "who deleted this" survives the deletion.
CREATE TABLE IF NOT EXISTS record_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type  TEXT NOT NULL,           -- staff | venue | settings
  subject_id    INTEGER,
  subject_label TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_label   TEXT NOT NULL,
  action        TEXT NOT NULL,
  field         TEXT,
  old_value     TEXT,
  new_value     TEXT,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_record_audit_at ON record_audit(at DESC);
CREATE INDEX IF NOT EXISTS idx_record_audit_actor ON record_audit(actor_user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_record_audit_subject
  ON record_audit(subject_type, subject_id, at DESC);

-- Single-use, time-limited links for staff who have forgotten their password.
-- The token is the whole secret, so a row is spent the moment it is used and
-- an unused one still expires on its own.
CREATE TABLE IF NOT EXISTS password_resets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  requested_ip TEXT,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resets_created ON password_resets(created_at DESC);

-- Small pieces of configuration an admin can change from inside the app, as
-- opposed to the ones that live in /etc/piper.env because they are secrets.
-- Values are stored as text and parsed by whoever reads them.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- The fleet, own and hired. A rental is a vehicle like any other; what makes it
-- different is that it has to go back, so it carries the dates it is held for
-- and the board can warn before one is due.
CREATE TABLE IF NOT EXISTS vehicles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  -- What it is. This is what gets booked: nobody phones for "a vehicle", they
  -- phone for a cube van.
  class              TEXT NOT NULL DEFAULT 'other'
                       CHECK (class IN ('cargo_van', 'cube_van', 'truck_26',
                                        'passenger', 'mini_van', 'other')),
  -- Where it comes from, which is who to phone about it. Pencar is the hire
  -- company Pynx uses; 'rental' covers anyone else; 'personal' is a crew
  -- member's own vehicle.
  ownership          TEXT NOT NULL DEFAULT 'other'
                       CHECK (ownership IN ('pencar', 'rental', 'personal', 'other')),
  -- Superseded by `ownership`, kept only because dropping it would mean
  -- rebuilding this table, and a rebuild takes dispatch_runs with it. Nothing
  -- reads or writes it; the default exists so old inserts stay legal.
  kind               TEXT NOT NULL DEFAULT 'van'
                       CHECK (kind IN ('van', 'truck', 'car', 'trailer', 'rental')),
  plate              TEXT,
  home_base          TEXT,                    -- where it lives when it is not out
  weight_capacity    TEXT,                    -- free text: crews say "1 ton", not 907kg
  passenger_capacity INTEGER,
  rental_from        TEXT,                    -- hires only
  rental_due         TEXT,                    -- hires only: back by this date
  capacity_note      TEXT,
  notes              TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(active, name);
CREATE INDEX IF NOT EXISTS idx_vehicles_class ON vehicles(class);

-- A vehicle committed to something, for a span of days. Usually a booking, but
-- not always — a service appointment or a warehouse move occupies a van just as
-- surely, so event_id is optional and `label` is what the board shows.
CREATE TABLE IF NOT EXISTS dispatch_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_id   INTEGER REFERENCES events(id) ON DELETE SET NULL,
  label      TEXT NOT NULL,
  -- What this day *is*, not merely that it is spoken for. 'needed' is the one
  -- that earns its keep: a vehicle the shop needs and has not booked.
  status     TEXT NOT NULL DEFAULT 'booked'
               CHECK (status IN ('booked', 'needed', 'idle', 'own', 'pynx', 'shop')),
  starts_on  TEXT NOT NULL,
  ends_on    TEXT NOT NULL,              -- same as starts_on for a single day
  meet_time  TEXT,                       -- when the crew meets, 'HH:MM'
  crew       TEXT,                       -- who is on it, as the shop writes it
  site       TEXT,                       -- city or site, when it isn't a booking
  driver_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  keys_with  TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_runs_status ON dispatch_runs(status, starts_on);
CREATE INDEX IF NOT EXISTS idx_runs_vehicle ON dispatch_runs(vehicle_id, starts_on);
CREATE INDEX IF NOT EXISTS idx_runs_dates ON dispatch_runs(starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_runs_event ON dispatch_runs(event_id);

-- The Gantt: a planning surface, deliberately independent of dispatch_runs.
-- Pencilling in "we'll want the cube that week" must not create a booking, and
-- booking a van must not silently redraw somebody's plan.
CREATE TABLE IF NOT EXISTS gantt_cells (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  state      TEXT NOT NULL
               CHECK (state IN ('booked', 'needed', 'idle', 'own', 'pynx')),
  starts_on  TEXT NOT NULL,
  ends_on    TEXT NOT NULL,
  note       TEXT,
  cleared_at TEXT,                     -- soft delete, so a clear-all is undoable
  batch      TEXT,                     -- groups one clear-all, for undo
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gantt_vehicle ON gantt_cells(vehicle_id, starts_on);
CREATE INDEX IF NOT EXISTS idx_gantt_dates ON gantt_cells(starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_gantt_live ON gantt_cells(cleared_at);
