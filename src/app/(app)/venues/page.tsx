import { requireAdmin } from "@/lib/auth";
import { listVenues } from "@/lib/events";
import { db } from "@/lib/db";
import { mapVenueName, removeVenue, saveVenue, unmapVenueName } from "./actions";
import VenueNotes from "@/components/VenueNotes";
import {
  listVenueAliases,
  notesForVenue,
  reportCountsByVenue,
  unmatchedVenues,
} from "@/lib/venue-reports";

function eventCounts(): Map<number, number> {
  const rows = db()
    .prepare("SELECT venue_id, COUNT(*) AS n FROM events WHERE venue_id IS NOT NULL GROUP BY venue_id")
    .all() as { venue_id: number; n: number }[];
  return new Map(rows.map((r) => [r.venue_id, r.n]));
}

export default async function VenuesPage() {
  await requireAdmin();
  const venues = listVenues();
  const counts = eventCounts();
  const reportCounts = reportCountsByVenue();
  const unmatched = unmatchedVenues();
  const aliases = listVenueAliases();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Venues</h1>
          <div className="topbar-sub">
            Load-in details you only want to figure out once
          </div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="card-head">
            <h2>Add a venue</h2>
          </div>
          <div className="card-body">
            <form action={saveVenue}>
              <div className="form-grid cols-3">
                <div className="field">
                  <label htmlFor="name">Name *</label>
                  <input id="name" name="name" type="text" required />
                </div>
                <div className="field">
                  <label htmlFor="address">Address</label>
                  <input id="address" name="address" type="text" />
                </div>
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" name="city" type="text" />
                </div>
                <div className="field">
                  <label htmlFor="contact_name">Contact</label>
                  <input id="contact_name" name="contact_name" type="text" />
                </div>
                <div className="field">
                  <label htmlFor="contact_email">Contact email</label>
                  <input id="contact_email" name="contact_email" type="email" />
                </div>
                <div className="field">
                  <label htmlFor="contact_phone">Contact phone</label>
                  <input id="contact_phone" name="contact_phone" type="tel" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="load_in_notes">Load-in notes</label>
                <textarea
                  id="load_in_notes"
                  name="load_in_notes"
                  rows={3}
                  placeholder="Parking, elevator, power, noise curfew, who to ask for…"
                />
              </div>
              <button className="btn btn-primary" type="submit">
                Add venue
              </button>
            </form>
          </div>
        </div>

        {venues.length === 0 ? (
          <div className="card">
            <div className="empty">No venues yet.</div>
          </div>
        ) : (
          venues.map((venue) => (
            <details className="card" key={venue.id}>
              <summary
                className="card-head"
                style={{ listStyle: "none", cursor: "pointer" }}
              >
                <div>
                  <h2>{venue.name}</h2>
                  <div className="faint small">
                    {[venue.city, venue.contact_name, venue.contact_phone].filter(Boolean).join(" · ") ||
                      "No details yet"}
                  </div>
                </div>
                <div className="venue-badges">
                  <span className="badge badge-plain">
                    {counts.get(venue.id) ?? 0} event{(counts.get(venue.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                  {(reportCounts.get(venue.id) ?? 0) > 0 && (
                    <span className="badge badge-accent">
                      {reportCounts.get(venue.id)} crew note
                      {reportCounts.get(venue.id) === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </summary>

              <div className="card-body">
                <form action={saveVenue}>
                  <input type="hidden" name="id" value={venue.id} />
                  <div className="form-grid cols-3">
                    <div className="field">
                      <label>Name *</label>
                      <input name="name" type="text" defaultValue={venue.name} required />
                    </div>
                    <div className="field">
                      <label>Address</label>
                      <input name="address" type="text" defaultValue={venue.address ?? ""} />
                    </div>
                    <div className="field">
                      <label>City</label>
                      <input name="city" type="text" defaultValue={venue.city ?? ""} />
                    </div>
                    <div className="field">
                      <label>Contact</label>
                      <input name="contact_name" type="text" defaultValue={venue.contact_name ?? ""} />
                    </div>
                    <div className="field">
                      <label>Contact email</label>
                      <input name="contact_email" type="email" defaultValue={venue.contact_email ?? ""} />
                    </div>
                    <div className="field">
                      <label>Contact phone</label>
                      <input name="contact_phone" type="tel" defaultValue={venue.contact_phone ?? ""} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Load-in notes</label>
                    <textarea name="load_in_notes" rows={3} defaultValue={venue.load_in_notes ?? ""} />
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-primary btn-sm" type="submit">
                      Save
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      type="submit"
                      formAction={removeVenue}
                      formNoValidate
                    >
                      Delete venue
                    </button>
                  </div>
                </form>

                <div className="venue-crew">
                  <h3>What crews have said</h3>
                  <p className="small muted">
                    Straight from the show and warehouse reports for jobs at this venue.
                  </p>
                  <VenueNotes notes={notesForVenue(venue.id)} />
                </div>
              </div>
            </details>
          ))
        )}

        {(unmatched.length > 0 || aliases.length > 0) && (
          <div className="card">
            <div className="card-head">
              <h2>Venue names from reports</h2>
              <span className="small muted">
                {unmatched.length > 0
                  ? `${unmatched.length} name${unmatched.length === 1 ? "" : "s"} Piper couldn't place`
                  : "All matched"}
              </span>
            </div>
            <div className="card-body">
              <p className="small muted">
                Crews type the venue in themselves, so spellings vary. Piper matches
                what it can and lists the rest here — point each one at the right venue
                and every past report using that name catches up too.
              </p>

              {unmatched.map((row) => (
                <form action={mapVenueName} className="venue-map" key={row.venue_raw}>
                  <input type="hidden" name="alias" value={row.venue_raw} />
                  <span className="venue-map-name">
                    {row.venue_raw}
                    <span className="small faint"> · {row.n} report{row.n === 1 ? "" : "s"}</span>
                  </span>
                  <select name="venue_id" required defaultValue="">
                    <option value="" disabled>
                      This is…
                    </option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm" type="submit">
                    Match
                  </button>
                </form>
              ))}

              {aliases.length > 0 && (
                <ul className="venue-alias-list">
                  {aliases.map((a) => (
                    <li key={a.alias}>
                      <span>
                        &ldquo;{a.alias}&rdquo; is <strong>{a.venue_name}</strong>
                      </span>
                      <form action={unmapVenueName}>
                        <input type="hidden" name="alias" value={a.alias} />
                        <input type="hidden" name="venue_id" value={a.venue_id} />
                        <button className="btn btn-sm" type="submit">
                          Undo
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
