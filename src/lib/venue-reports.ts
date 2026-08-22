import { db } from "./db";

/**
 * What crews have said about a venue.
 *
 * Venue notes used to be something you typed once and hoped stayed true. The
 * people who actually know a room are the ones who loaded into it — so once
 * the report form asks which venue a job was at, every note a crew leaves
 * accumulates on that venue's record, dated, and attributed.
 *
 * Crews type the name freely, so it arrives as text and has to be matched.
 * `venue_raw` keeps exactly what they typed: an unmatched name stays visible
 * and fixable rather than being silently dropped.
 */

/** Folds the differences that don't matter: case, punctuation, a leading "the". */
export function normalizeVenue(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

/**
 * Matches a typed venue name to a venue record: an exact name match first,
 * then the alias list. Returns null rather than guessing — a wrong match puts
 * one venue's load-in notes on another's page, which is worse than no match.
 */
export function resolveVenue(raw: string | null | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const wanted = normalizeVenue(raw);
  if (!wanted) return null;

  const venues = db().prepare("SELECT id, name FROM venues").all() as {
    id: number;
    name: string;
  }[];
  const byName = venues.find((v) => normalizeVenue(v.name) === wanted);
  if (byName) return byName.id;

  const alias = db()
    .prepare("SELECT venue_id FROM venue_aliases WHERE alias = ?")
    .get(raw.trim()) as { venue_id: number } | undefined;
  return alias?.venue_id ?? null;
}

/**
 * Re-runs matching over reports that never matched. Called after a venue is
 * added or an alias is set, so history catches up rather than only new
 * reports benefiting.
 */
export function relinkVenues(): number {
  const orphans = db()
    .prepare("SELECT id, venue_raw FROM crew_reports WHERE venue_id IS NULL AND venue_raw IS NOT NULL")
    .all() as { id: number; venue_raw: string }[];

  const update = db().prepare("UPDATE crew_reports SET venue_id = ? WHERE id = ?");
  let linked = 0;

  const run = db().transaction(() => {
    for (const row of orphans) {
      const venueId = resolveVenue(row.venue_raw);
      if (venueId !== null) {
        update.run(venueId, row.id);
        linked += 1;
      }
    }
  });

  run();
  return linked;
}

export type VenueNote = {
  id: number;
  job_raw: string;
  crew_raw: string | null;
  sent_at: string;
  kind: "dj" | "warehouse";
  notes: string;
  quality: number | null;
};

/** Notes crews left about a venue, newest first. Test entries never count. */
export function notesForVenue(venueId: number, limit = 30): VenueNote[] {
  return db()
    .prepare(
      `SELECT id, job_raw, crew_raw, sent_at, kind, notes, quality
       FROM crew_reports
       WHERE venue_id = ? AND is_test = 0 AND notes IS NOT NULL AND TRIM(notes) <> ''
       ORDER BY sent_at DESC
       LIMIT ?`,
    )
    .all(venueId, limit) as VenueNote[];
}

/** How many real reports mention each venue, for the venue list. */
export function reportCountsByVenue(): Map<number, number> {
  const rows = db()
    .prepare(
      `SELECT venue_id, COUNT(*) AS n FROM crew_reports
       WHERE venue_id IS NOT NULL AND is_test = 0
       GROUP BY venue_id`,
    )
    .all() as { venue_id: number; n: number }[];
  return new Map(rows.map((r) => [r.venue_id, r.n]));
}

export type UnmatchedVenue = { venue_raw: string; n: number };

/** Names crews used that Piper could not match, so they can be mapped. */
export function unmatchedVenues(): UnmatchedVenue[] {
  return db()
    .prepare(
      `SELECT venue_raw, COUNT(*) AS n FROM crew_reports
       WHERE venue_id IS NULL AND venue_raw IS NOT NULL AND TRIM(venue_raw) <> ''
         AND is_test = 0
       GROUP BY venue_raw COLLATE NOCASE
       ORDER BY n DESC, venue_raw`,
    )
    .all() as UnmatchedVenue[];
}

export function addVenueAlias(alias: string, venueId: number): void {
  db()
    .prepare(
      `INSERT INTO venue_aliases (alias, venue_id) VALUES (?, ?)
       ON CONFLICT(alias) DO UPDATE SET venue_id = excluded.venue_id`,
    )
    .run(alias.trim(), venueId);
}

/**
 * Removes a mapping and unlinks the reports it linked.
 *
 * Deleting the alias alone would leave every report it had already matched
 * still pointing at the venue, so undoing a mistake would appear to do
 * nothing. Reports that match the venue by name are left alone — those never
 * needed the alias.
 */
export function removeVenueAlias(alias: string): void {
  const mapping = db()
    .prepare("SELECT venue_id FROM venue_aliases WHERE alias = ?")
    .get(alias) as { venue_id: number } | undefined;

  const run = db().transaction(() => {
    db().prepare("DELETE FROM venue_aliases WHERE alias = ?").run(alias);
    if (!mapping) return;

    const linked = db()
      .prepare("SELECT id, venue_raw FROM crew_reports WHERE venue_id = ? AND venue_raw IS NOT NULL")
      .all(mapping.venue_id) as { id: number; venue_raw: string }[];

    const clear = db().prepare("UPDATE crew_reports SET venue_id = NULL WHERE id = ?");
    for (const row of linked) {
      // resolveVenue now runs without the alias, so anything that still
      // resolves matched by name and keeps its link.
      if (resolveVenue(row.venue_raw) === null) clear.run(row.id);
    }
  });

  run();
}

export function listVenueAliases(): { alias: string; venue_id: number; venue_name: string }[] {
  return db()
    .prepare(
      `SELECT a.alias, a.venue_id, v.name AS venue_name
       FROM venue_aliases a JOIN venues v ON v.id = a.venue_id
       ORDER BY v.name, a.alias`,
    )
    .all() as { alias: string; venue_id: number; venue_name: string }[];
}
