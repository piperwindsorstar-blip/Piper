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
  {
    version: 4,
    label: "audit trail on events",
    up: `
      CREATE TABLE IF NOT EXISTS event_audit (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id      INTEGER NOT NULL,
        event_label   TEXT NOT NULL,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        actor_label   TEXT NOT NULL,
        action        TEXT NOT NULL CHECK (action IN
                        ('created', 'updated', 'deleted', 'plan_link_rotated', 'plan_submitted')),
        field         TEXT,
        old_value     TEXT,
        new_value     TEXT,
        at            TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_event ON event_audit(event_id, at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_at ON event_audit(at DESC);

      -- Bookings that predate the trail still get a first entry, so their
      -- history reads as "existed before this was turned on" rather than blank.
      INSERT INTO event_audit (event_id, event_label, actor_user_id, actor_label, action, at)
      SELECT
        id,
        partner_one_name || COALESCE(' & ' || partner_two_name, '') || ' · ' || event_date,
        NULL,
        'Before history was kept',
        'created',
        created_at
      FROM events;
    `,
  },
  {
    version: 5,
    label: "outbox and availability requests",
    up: `
      CREATE TABLE IF NOT EXISTS outbox (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
        kind        TEXT NOT NULL,
        to_addr     TEXT NOT NULL,
        cc_addr     TEXT,
        subject     TEXT NOT NULL,
        body        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
        queued_at   TEXT NOT NULL,
        sent_at     TEXT,
        error       TEXT,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, queued_at DESC);
      CREATE INDEX IF NOT EXISTS idx_outbox_event ON outbox(event_id);

      CREATE TABLE IF NOT EXISTS availability_requests (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        dj_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token        TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'asked'
                       CHECK (status IN ('asked', 'available', 'unavailable')),
        note         TEXT,
        asked_at     TEXT NOT NULL,
        responded_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_avail_once ON availability_requests(event_id, dj_id);
      CREATE INDEX IF NOT EXISTS idx_avail_event ON availability_requests(event_id);
    `,
  },
  {
    version: 6,
    label: "venues on crew reports",
    up: `
      ALTER TABLE crew_reports ADD COLUMN venue_raw TEXT;
      ALTER TABLE crew_reports ADD COLUMN venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_reports_venue ON crew_reports(venue_id);

      CREATE TABLE IF NOT EXISTS venue_aliases (
        alias      TEXT PRIMARY KEY COLLATE NOCASE,
        venue_id   INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_venue_alias_venue ON venue_aliases(venue_id);
    `,
  },
  {
    version: 7,
    label: "sign-in log and audit for records other than bookings",
    up: `
      CREATE TABLE IF NOT EXISTS sign_ins (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        email_tried TEXT NOT NULL,
        actor_label TEXT NOT NULL,
        outcome     TEXT NOT NULL CHECK (outcome IN ('success', 'failed')),
        reason      TEXT,
        ip          TEXT,
        user_agent  TEXT,
        at          TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_signins_at ON sign_ins(at DESC);
      CREATE INDEX IF NOT EXISTS idx_signins_user ON sign_ins(user_id, at DESC);

      CREATE TABLE IF NOT EXISTS record_audit (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_type  TEXT NOT NULL,
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
    `,
  },
  {
    version: 8,
    label: "password reset links",
    up: `
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
    `,
  },
  {
    version: 9,
    label: "settings",
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `,
  },
  {
    version: 10,
    label: "vehicles and dispatch",
    up: `
      CREATE TABLE IF NOT EXISTS vehicles (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        kind          TEXT NOT NULL DEFAULT 'van'
                        CHECK (kind IN ('van', 'truck', 'car', 'trailer', 'rental')),
        plate         TEXT,
        rental_from   TEXT,
        rental_due    TEXT,
        capacity_note TEXT,
        notes         TEXT,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(active, name);

      CREATE TABLE IF NOT EXISTS dispatch_runs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        event_id   INTEGER REFERENCES events(id) ON DELETE SET NULL,
        label      TEXT NOT NULL,
        starts_on  TEXT NOT NULL,
        ends_on    TEXT NOT NULL,
        driver_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        keys_with  TEXT,
        notes      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_runs_vehicle ON dispatch_runs(vehicle_id, starts_on);
      CREATE INDEX IF NOT EXISTS idx_runs_dates ON dispatch_runs(starts_on, ends_on);
      CREATE INDEX IF NOT EXISTS idx_runs_event ON dispatch_runs(event_id);
    `,
  },
  {
    version: 11,
    label: "dispatch reshaped to match how the shop actually works",
    up: `
      -- 'ownership' supersedes 'kind'. The old column stays because changing a
      -- CHECK constraint means rebuilding the table, and a rebuild here would
      -- silently take the runs with it: DROP TABLE fires ON DELETE CASCADE on
      -- the children even inside a transaction with defer_foreign_keys on.
      -- Tested, watched two runs vanish, and backed away. Nothing writes 'kind'
      -- any more; its NOT NULL default keeps old inserts legal.
      ALTER TABLE vehicles ADD COLUMN ownership TEXT NOT NULL DEFAULT 'other'
        CHECK (ownership IN ('pencar', 'rental', 'personal', 'other'));
      UPDATE vehicles SET ownership = CASE kind WHEN 'rental' THEN 'rental' ELSE 'other' END;

      ALTER TABLE vehicles ADD COLUMN home_base TEXT;
      ALTER TABLE vehicles ADD COLUMN weight_capacity TEXT;
      ALTER TABLE vehicles ADD COLUMN passenger_capacity INTEGER;

      -- A day on the board is a state, not merely occupied-or-not. 'needed' is
      -- the one that earns the column: a van the shop needs and has not booked
      -- is the thing worth seeing a month out.
      ALTER TABLE dispatch_runs ADD COLUMN status TEXT NOT NULL DEFAULT 'booked'
        CHECK (status IN ('booked', 'needed', 'idle', 'own', 'pynx', 'shop'));
      ALTER TABLE dispatch_runs ADD COLUMN meet_time TEXT;
      ALTER TABLE dispatch_runs ADD COLUMN crew TEXT;
      ALTER TABLE dispatch_runs ADD COLUMN site TEXT;
      CREATE INDEX IF NOT EXISTS idx_runs_status ON dispatch_runs(status, starts_on);
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
