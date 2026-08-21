import { requireAdmin } from "@/lib/auth";
import { listVenues } from "@/lib/events";
import { db } from "@/lib/db";
import { removeVenue, saveVenue } from "./actions";

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
                <span className="badge badge-plain">
                  {counts.get(venue.id) ?? 0} event{(counts.get(venue.id) ?? 0) === 1 ? "" : "s"}
                </span>
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
              </div>
            </details>
          ))
        )}
      </div>
    </>
  );
}
