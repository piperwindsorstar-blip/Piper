import { notFound } from "next/navigation";
import { getEventByToken } from "@/lib/events";
import { getQuestionnaire, songsByCategory } from "@/lib/planning";
import { formatDateLong } from "@/lib/dates";
import { SONG_CATEGORIES } from "@/lib/types";
import { clientAddSong, clientDeleteSong, clientSubmitPlan } from "./actions";

export const metadata = { title: "Your wedding music planner" };

export default async function PlannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = getEventByToken(token);
  if (!event || event.status === "cancelled") notFound();

  const songs = songsByCategory(event.id);
  const q = getQuestionnaire(event.id);
  const couple = `${event.partner_one_name}${event.partner_two_name ? ` & ${event.partner_two_name}` : ""}`;

  return (
    <main className="planner">
      <div className="planner-hero">
        <h1>{couple}</h1>
        <p className="muted">
          {formatDateLong(event.event_date)}
          {event.venue_name ? ` · ${event.venue_name}` : ""}
        </p>
        {event.plan_submitted_at ? (
          <span className="badge badge-confirmed">Sent to your DJ — you can still make changes</span>
        ) : (
          <span className="badge badge-plain">Draft — nothing is sent until you hit submit</span>
        )}
      </div>

      <div className="alert alert-info">
        Everything saves as you go. Add as much or as little as you like — your DJ fills the gaps.
      </div>

      {SONG_CATEGORIES.filter((c) => c.client).map((category) => {
        const list = songs.get(category.key) ?? [];
        const isDoNotPlay = category.key === "do_not_play";

        return (
          <div className="card planner-section" key={category.key}>
            <div className="card-head">
              <div>
                <h2 style={isDoNotPlay ? { color: "var(--danger)" } : undefined}>{category.label}</h2>
                <div className="faint small">{category.hint}</div>
              </div>
            </div>

            <div className="card-body tight">
              {list.map((song) => (
                <div className="song-line" key={song.id}>
                  <div className="song-main">
                    <div className="song-title">{song.title}</div>
                    {(song.artist || song.notes) && (
                      <div className="song-sub">
                        {song.artist}
                        {song.artist && song.notes ? " · " : ""}
                        {song.notes}
                      </div>
                    )}
                  </div>
                  {song.source === "client" ? (
                    <form action={clientDeleteSong} className="inline-form">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="id" value={song.id} />
                      <button className="btn btn-icon btn-danger" type="submit" aria-label="Remove">
                        ✕
                      </button>
                    </form>
                  ) : (
                    <span className="badge badge-plain">From your DJ</span>
                  )}
                </div>
              ))}

              <form action={clientAddSong} style={{ marginTop: list.length ? "0.75rem" : 0 }}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="category" value={category.key} />
                <div className="form-grid" style={{ gap: "0 0.6rem" }}>
                  <div className="field" style={{ marginBottom: "0.6rem" }}>
                    <input name="title" type="text" placeholder="Song title" required />
                  </div>
                  <div className="field" style={{ marginBottom: "0.6rem" }}>
                    <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                      <input name="artist" type="text" placeholder="Artist" />
                      <button className="btn btn-sm" type="submit">
                        {category.single && list.length ? "Replace" : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })}

      <div className="card planner-section">
        <div className="card-head">
          <h2>A few questions</h2>
        </div>
        <div className="card-body">
          <form action={clientSubmitPlan}>
            <input type="hidden" name="token" value={token} />

            <div className="field">
              <label htmlFor="preferred_genres">What should keep the floor full?</label>
              <input
                id="preferred_genres"
                name="preferred_genres"
                type="text"
                placeholder="e.g. 90s hip hop, Motown, current pop"
                defaultValue={q?.preferred_genres ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="avoid_genres">Anything to steer clear of?</label>
              <input
                id="avoid_genres"
                name="avoid_genres"
                type="text"
                placeholder="e.g. no country, no heavy EDM"
                defaultValue={q?.avoid_genres ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="vibe_notes">Tell us about the night you&rsquo;re picturing</label>
              <textarea
                id="vibe_notes"
                name="vibe_notes"
                rows={4}
                placeholder="Formal or loose? Big dance party or background music? Anything that matters to you."
                defaultValue={q?.vibe_notes ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="wedding_party">Wedding party names for introductions</label>
              <textarea
                id="wedding_party"
                name="wedding_party"
                rows={3}
                placeholder="One per line, in the order they should enter."
                defaultValue={q?.wedding_party ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="announcements">Announcements &amp; tricky pronunciations</label>
              <textarea
                id="announcements"
                name="announcements"
                rows={3}
                placeholder="Names to say carefully, shuttle times, anything to announce."
                defaultValue={q?.announcements ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="mic_needs">Who needs a microphone?</label>
              <input
                id="mic_needs"
                name="mic_needs"
                type="text"
                placeholder="e.g. officiant, 3 toasts, a reading"
                defaultValue={q?.mic_needs ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="contact_on_day">Who do we call on the day?</label>
              <input
                id="contact_on_day"
                name="contact_on_day"
                type="text"
                placeholder="Name and number — usually not the couple"
                defaultValue={q?.contact_on_day ?? ""}
              />
            </div>

            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  name="takes_requests"
                  value="1"
                  defaultChecked={q ? q.takes_requests === 1 : true}
                />
                Guests can request songs on the night
              </label>
            </div>

            <button className="btn btn-primary" type="submit">
              {event.plan_submitted_at ? "Save changes" : "Send this to our DJ"}
            </button>
          </form>
        </div>
      </div>

      <p className="small faint" style={{ textAlign: "center", marginTop: "2rem" }}>
        This link is private to you. Keep it handy — you can come back and change anything up to the
        day.
      </p>
    </main>
  );
}
