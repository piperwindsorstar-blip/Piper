import Link from "next/link";
import { headers } from "next/headers";
import { conflictsFor, getVenue } from "@/lib/events";
import { getQuestionnaire, songsByCategory, timelineForEvent } from "@/lib/planning";
import { formatDate, formatTime } from "@/lib/dates";
import { SONG_CATEGORIES } from "@/lib/types";
import { removeEvent, rotatePlanLink } from "../actions";
import CopyLink from "@/components/CopyLink";
import History from "@/components/History";
import { eventHistory, groupEntries } from "@/lib/audit";
import { loadEvent } from "./guard";

async function plannerUrl(token: string): Promise<string> {
  const head = await headers();
  const host = head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/plan/${token}`;
}

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, event } = await loadEvent(id);
  const isAdmin = user.role === "admin";

  const venue = event.venue_id ? getVenue(event.venue_id) : null;
  const conflicts = conflictsFor(event.id, event.event_date, event.assigned_dj_id);
  const songs = songsByCategory(event.id);
  const songCount = [...songs.values()].reduce((n, list) => n + list.length, 0);
  const timeline = timelineForEvent(event.id);
  const questionnaire = getQuestionnaire(event.id);
  const link = await plannerUrl(event.plan_token);

  // Only read the history for admins. Entries carry the old and new text of
  // every field including the internal notes, and anything handed to the page
  // is serialised into the HTML whether it is rendered or not.
  const history = isAdmin ? groupEntries(eventHistory(event.id)) : [];

  const keySlots = SONG_CATEGORIES.filter((c) =>
    ["first_dance", "grand_entrance", "last_dance"].includes(c.key),
  );

  return (
    <>
      {conflicts.length > 0 && (
        <div className={`alert ${conflicts.some((c) => c.kind === "dj") ? "alert-error" : "alert-warn"}`}>
          <strong>
            {conflicts.some((c) => c.kind === "dj") ? "DJ double-booked:" : "Another event that day:"}
          </strong>{" "}
          {conflicts.map((c, i) => (
            <span key={c.event.id}>
              {i > 0 && ", "}
              <Link href={`/events/${c.event.id}`}>
                {c.event.partner_one_name}
                {c.event.partner_two_name ? ` & ${c.event.partner_two_name}` : ""}
              </Link>
              {c.kind === "dj" ? ` (same DJ: ${c.event.dj_name})` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Run of day</h2>
          </div>
          <div className="card-body">
            <div className="meta-list">
              <div className="meta-item">
                <div className="meta-label">Load in</div>
                <div className="meta-value">{formatTime(event.load_in_time)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Ceremony</div>
                <div className="meta-value">{formatTime(event.ceremony_time)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Cocktails</div>
                <div className="meta-value">{formatTime(event.cocktail_time)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Reception</div>
                <div className="meta-value">{formatTime(event.reception_time)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Music off</div>
                <div className="meta-value">{formatTime(event.end_time)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Guests</div>
                <div className="meta-value">{event.guest_count ?? "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Package</div>
                <div className="meta-value">{event.package_name ?? "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">DJ</div>
                <div className="meta-value">{event.dj_name ?? "Unassigned"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Contact &amp; venue</h2>
          </div>
          <div className="card-body">
            <div className="meta-list">
              <div className="meta-item">
                <div className="meta-label">Couple email</div>
                <div className="meta-value">
                  {event.contact_email ? (
                    <a href={`mailto:${event.contact_email}`}>{event.contact_email}</a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Couple phone</div>
                <div className="meta-value">
                  {event.contact_phone ? <a href={`tel:${event.contact_phone}`}>{event.contact_phone}</a> : "—"}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Venue</div>
                <div className="meta-value">
                  {venue ? (
                    <>
                      {venue.name}
                      {event.venue_room ? ` — ${event.venue_room}` : ""}
                      {venue.address && <div className="faint small">{venue.address}</div>}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Venue contact</div>
                <div className="meta-value">
                  {venue?.contact_name ?? "—"}
                  {venue?.contact_phone && <div className="faint small">{venue.contact_phone}</div>}
                </div>
              </div>
            </div>
            {venue?.load_in_notes && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Load-in notes</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {venue.load_in_notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: "1.1rem" }}>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <h2>Planning status</h2>
            <Link className="small" href={`/events/${event.id}/music`}>
              Open music →
            </Link>
          </div>
          <div className="card-body">
            <div className="meta-list" style={{ marginBottom: "1rem" }}>
              <div className="meta-item">
                <div className="meta-label">Songs logged</div>
                <div className="meta-value">{songCount}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Timeline items</div>
                <div className="meta-value">{timeline.length}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Couple&rsquo;s planner</div>
                <div className="meta-value">
                  {event.plan_submitted_at ? (
                    <span className="badge badge-confirmed">Submitted</span>
                  ) : (
                    <span className="badge badge-plain">Not submitted</span>
                  )}
                </div>
              </div>
            </div>

            <div className="stack">
              {keySlots.map((slot) => {
                const pick = songs.get(slot.key)?.[0];
                return (
                  <div key={slot.key} className="row-between small">
                    <span className="muted">{slot.label}</span>
                    <span>
                      {pick ? (
                        <>
                          {pick.title}
                          {pick.artist ? <span className="faint"> — {pick.artist}</span> : null}
                        </>
                      ) : (
                        <span className="faint">Not picked</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {questionnaire?.vibe_notes && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Vibe notes from the couple</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {questionnaire.vibe_notes}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <h2>Couple&rsquo;s planner link</h2>
          </div>
          <div className="card-body">
            <p className="small muted">
              Send this to the couple. It opens their music and timeline planner — no login, and it
              never exposes your internal notes.
            </p>
            <div className="field">
              <CopyLink value={link} />
            </div>
            <div className="btn-row">
              <a className="btn btn-sm" href={`/plan/${event.plan_token}`} target="_blank" rel="noreferrer">
                Preview
              </a>
              {event.contact_email && (
                <a
                  className="btn btn-sm"
                  href={`mailto:${event.contact_email}?subject=${encodeURIComponent(
                    "Your wedding music planner",
                  )}&body=${encodeURIComponent(
                    `Hi! Here's your music and timeline planner for ${formatDate(
                      event.event_date,
                    )}:\n\n${link}\n\nFill it in whenever you like — it saves as you go.`,
                  )}`}
                >
                  Email link
                </a>
              )}
              {isAdmin && (
                <form action={rotatePlanLink} className="inline-form">
                  <input type="hidden" name="id" value={event.id} />
                  <button className="btn btn-sm btn-danger" type="submit">
                    Revoke &amp; regenerate
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {event.internal_notes && (
        <div className="card">
          <div className="card-head">
            <h2>Internal notes</h2>
          </div>
          <div className="card-body" style={{ whiteSpace: "pre-wrap" }}>
            {event.internal_notes}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-head">
            <h2>History</h2>
            <span className="small muted">Who changed what on this booking</span>
          </div>
          <History groups={history} empty="No changes recorded yet." />
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-body row-between">
            <div>
              <strong>Delete this event</strong>
              <div className="small muted">
                Removes the event with its songs, timeline and planner link. Cannot be undone.
              </div>
            </div>
            <form action={removeEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button className="btn btn-danger" type="submit">
                Delete event
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
