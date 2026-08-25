import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth";
import { buildDayOf } from "@/lib/dayof";
import { formatDate, formatTime } from "@/lib/dates";

/**
 * The sheet a DJ reads at the booth.
 *
 * Laid out like the planning spreadsheet the wedding side was built from —
 * Time, Section, Activity, Song, Artist, Cue — because that is the order the
 * office already thinks in. A sheet that reads differently from the one the
 * plan was made on is a sheet somebody has to translate at eleven at night.
 *
 * Built to be printed as much as scrolled: a phone dies, a venue has no
 * signal, and the paper in the flight case does not.
 */
export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireArea("weddings", "view");
  const { id } = await params;

  const eventId = Number(id);
  if (!Number.isInteger(eventId)) notFound();

  const sheet = buildDayOf(user, eventId);
  if (!sheet) notFound();

  const { event, rows, mustPlay, doNotPlay, facts, notes, playlists, venueNotes } = sheet;
  const couple = event.partner_two_name
    ? `${event.partner_one_name} & ${event.partner_two_name}`
    : event.partner_one_name;

  return (
    <div className="dayof">
      <header className="dayof-head">
        <div>
          <h1>{couple}</h1>
          <div className="dayof-sub">
            {formatDate(event.event_date)}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
            {event.venue_room ? ` — ${event.venue_room}` : ""}
            {event.dj_name ? ` · DJ ${event.dj_name}` : ""}
          </div>
        </div>
        <div className="dayof-times">
          {(
            [
              ["Load in", event.load_in_time],
              ["Ceremony", event.ceremony_time],
              ["Cocktails", event.cocktail_time],
              ["Reception", event.reception_time],
              ["Finish", event.end_time],
            ] as const
          )
            .filter(([, t]) => t)
            .map(([label, t]) => (
              <span key={label}>
                <strong>{label}</strong> {formatTime(t as string)}
              </span>
            ))}
        </div>
      </header>

      {facts.length > 0 && (
        <dl className="dayof-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <table className="dayof-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Section</th>
            <th>Activity</th>
            <th>Song Title</th>
            <th>Artist</th>
            <th>Cue / Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.section}-${row.activity}-${i}`}
              className={[
                row.empty ? "dayof-empty" : "",
                row.fromTimeline ? "dayof-moment" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <td className="dayof-time">{row.time ? formatTime(row.time) : ""}</td>
              <td className="dayof-section">{row.section}</td>
              <td className="dayof-activity">{row.activity}</td>
              <td className="dayof-title">{row.title ?? (row.empty ? "—" : "")}</td>
              <td>{row.artist ?? ""}</td>
              <td className="dayof-cue">
                {[row.cue, row.notes].filter(Boolean).join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="dayof-lists">
        <section>
          <h2>Must play</h2>
          {mustPlay.length === 0 ? (
            <p className="faint small">Nothing listed.</p>
          ) : (
            <ul>
              {mustPlay.map((s) => (
                <li key={s.id}>
                  {s.title}
                  {s.artist ? <span className="faint"> — {s.artist}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dayof-never">
          <h2>Do NOT play</h2>
          {doNotPlay.length === 0 ? (
            <p className="faint small">Nothing listed.</p>
          ) : (
            <ul>
              {doNotPlay.map((s) => (
                <li key={s.id}>
                  {s.title}
                  {s.artist ? <span className="faint"> — {s.artist}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(notes.length > 0 || playlists.length > 0 || venueNotes.length > 0) && (
        <div className="dayof-notes">
          {notes.map((n) => (
            <p key={n.label}>
              <strong>{n.label}:</strong> {n.value}
            </p>
          ))}
          {playlists.map((p) => (
            <p key={p.label}>
              <strong>{p.label} playlist:</strong> <span className="dayof-link">{p.value}</span>
            </p>
          ))}
          {venueNotes.length > 0 && (
            <>
              <p>
                <strong>Crews have said about {event.venue_name}:</strong>
              </p>
              <ul>
                {venueNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="dayof-foot faint small">
        Piper · printed from the plan as it stood. Check the app if the couple has been
        in touch since.
      </p>
    </div>
  );
}
