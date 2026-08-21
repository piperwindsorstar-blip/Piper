/**
 * Schema migrations.
 *
 * `schema.sql` describes the database as it looks *today* and is used to create
 * a fresh one. It cannot alter a database that already exists — every statement
 * is `IF NOT EXISTS`, so a new column on an existing table would be skipped
 * silently and the app would then query a column that isn't there.
 *
 * So: a fresh database gets `schema.sql` and is stamped at LATEST. An existing
 * one runs each migration above its recorded version, in order, once.
 *
 * To change the schema: add the statement to `schema.sql` for new installs AND
 * add a migration here for existing ones. Never edit a released migration —
 * databases in the wild have already run it. Add a new one instead.
 */
export type Migration = { version: number; label: string; up: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    label: "staff records on users",
    up: `
      ALTER TABLE users ADD COLUMN emergency_contact TEXT;
      ALTER TABLE users ADD COLUMN start_date TEXT;
      ALTER TABLE users ADD COLUMN gear TEXT;
      ALTER TABLE users ADD COLUMN staff_notes TEXT;
    `,
  },
  {
    version: 2,
    label: "crew reports, aliases and event job numbers",
    up: `
      CREATE TABLE IF NOT EXISTS crew_reports (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kind          TEXT NOT NULL CHECK (kind IN ('dj', 'warehouse')),
        report_type   TEXT,
        job_raw       TEXT NOT NULL,
        job_norm      TEXT NOT NULL,
        crew_raw      TEXT,
        sent_at       TEXT NOT NULL,
        vdp           TEXT,
        rating_client INTEGER,
        rating_crowd  INTEGER,
        rating_staff  INTEGER,
        quality       INTEGER,
        manifest      TEXT CHECK (manifest IN ('yes', 'no', 'na')),
        manifest_override TEXT CHECK (manifest_override IN ('yes', 'no')),
        notes         TEXT,
        is_test       INTEGER NOT NULL DEFAULT 0,
        source_id     TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_dedupe ON crew_reports(kind, job_norm, sent_at);
      CREATE INDEX IF NOT EXISTS idx_reports_job ON crew_reports(job_norm);
      CREATE INDEX IF NOT EXISTS idx_reports_sent ON crew_reports(sent_at);

      CREATE TABLE IF NOT EXISTS crew_aliases (
        alias      TEXT PRIMARY KEY COLLATE NOCASE,
        canonical  TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      ALTER TABLE events ADD COLUMN job_number TEXT;
    `,
  },
  {
    version: 3,
    label: "planner realigned to the Pynx planning form",
    up: `
      ALTER TABLE songs ADD COLUMN cue TEXT;
      ALTER TABLE songs ADD COLUMN link TEXT;

      ALTER TABLE questionnaires ADD COLUMN request_policy TEXT;
      ALTER TABLE questionnaires ADD COLUMN dedications TEXT;
      ALTER TABLE questionnaires ADD COLUMN last_name_taken TEXT;
      ALTER TABLE questionnaires ADD COLUMN arrival_time TEXT;
      ALTER TABLE questionnaires ADD COLUMN mc_name TEXT;
      ALTER TABLE questionnaires ADD COLUMN bridesmaids TEXT;
      ALTER TABLE questionnaires ADD COLUMN groomsmen TEXT;
      ALTER TABLE questionnaires ADD COLUMN venue_phone TEXT;
      ALTER TABLE questionnaires ADD COLUMN coordinator_email TEXT;
      ALTER TABLE questionnaires ADD COLUMN table_reserved TEXT;
      ALTER TABLE questionnaires ADD COLUMN space_reserved TEXT;
      ALTER TABLE questionnaires ADD COLUMN power_each_space TEXT;
      ALTER TABLE questionnaires ADD COLUMN outdoor_portions TEXT;
      ALTER TABLE questionnaires ADD COLUMN uplight_colours TEXT;
      ALTER TABLE questionnaires ADD COLUMN photobooth_hours TEXT;
      ALTER TABLE questionnaires ADD COLUMN playlist_pre_ceremony TEXT;
      ALTER TABLE questionnaires ADD COLUMN playlist_cocktail TEXT;
      ALTER TABLE questionnaires ADD COLUMN playlist_dinner TEXT;
      ALTER TABLE questionnaires ADD COLUMN playlist_dance TEXT;

      -- The old yes/no checkbox becomes free text; carry the answer across.
      UPDATE questionnaires SET request_policy =
        CASE WHEN takes_requests = 1
             THEN 'Guests can request songs on the night'
             ELSE 'No requests from the floor' END
        WHERE request_policy IS NULL;

      CREATE TABLE IF NOT EXISTS entrance_order (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        role     TEXT NOT NULL,
        names    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_entrance_event ON entrance_order(event_id, position);

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

      CREATE TABLE IF NOT EXISTS recommendations (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        category     TEXT NOT NULL,
        title        TEXT NOT NULL,
        artist       TEXT,
        times_picked INTEGER NOT NULL DEFAULT 1,
        note         TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reco_unique
        ON recommendations(category, title, COALESCE(artist, ''));

      -- Slot names changed with the form realignment.
      UPDATE songs SET category = 'bridal_party_processional' WHERE category = 'ceremony_processional';
      UPDATE songs SET category = 'guest_arrival'             WHERE category = 'ceremony_prelude';
      UPDATE songs SET category = 'recessional'               WHERE category = 'ceremony_recessional';
      UPDATE songs SET category = 'grand_entrance_couple'     WHERE category = 'grand_entrance';
      UPDATE songs SET category = 'father_daughter'           WHERE category = 'parent_dance_one';
      UPDATE songs SET category = 'mother_son'                WHERE category = 'parent_dance_two';
      UPDATE songs SET category = 'bouquet_garter'            WHERE category = 'bouquet_toss';
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
