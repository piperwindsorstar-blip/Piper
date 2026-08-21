import { notFound } from "next/navigation";
import { getEventByToken } from "@/lib/events";
import {
  entranceOrder,
  getQuestionnaire,
  recommendationsFor,
  songsByCategory,
  speeches,
} from "@/lib/planning";
import { formatDateLong } from "@/lib/dates";
import { SONG_CATEGORIES, SONG_SECTIONS, type SongSection } from "@/lib/types";
import { clientAddSong, clientDeleteSong, clientSubmitPlan } from "./actions";
import RowEditor from "./RowEditor";
import SlotPicker from "./SlotPicker";

export const metadata = { title: "Your wedding music planner" };

const SECTION_BLURB: Record<SongSection, string> = {
  Ceremony: "Walking in, signing, walking back out.",
  "Cocktail Time": "While guests mingle between the ceremony and dinner.",
  Reception: "Entrances, dances, dinner and the dance floor.",
  Anytime: "The songs that matter wherever they land in the night.",
};

export default async function PlannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = getEventByToken(token);
  if (!event || event.status === "cancelled") notFound();

  const songs = songsByCategory(event.id);
  const q = getQuestionnaire(event.id);
  const entrance = entranceOrder(event.id);
  const speechRows = speeches(event.id);
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
        If a song should start or stop at a particular moment, say so; that&rsquo;s the difference
        between a clean first dance and a guess.
      </div>

      {SONG_SECTIONS.map((section) => {
        const slots = SONG_CATEGORIES.filter((c) => c.client && c.section === section);
        if (slots.length === 0) return null;

        return (
          <section key={section}>
            <div className="planner-section-head">
              <h2>{section}</h2>
              <p className="faint small">{SECTION_BLURB[section]}</p>
            </div>

            {slots.map((category) => {
              const list = songs.get(category.key) ?? [];
              const isDoNotPlay = category.key === "do_not_play";
              const recommendations = isDoNotPlay ? [] : recommendationsFor(category.key);

              return (
                <div className="card planner-section" key={category.key}>
                  <div className="card-head">
                    <div>
                      <h3 style={isDoNotPlay ? { color: "var(--danger)" } : undefined}>
                        {category.label}
                        {category.optional && <span className="badge badge-plain"> Optional</span>}
                      </h3>
                      <div className="faint small">{category.hint}</div>
                    </div>
                  </div>

                  <div className="card-body tight">
                    {list.map((song) => (
                      <div className="song-line" key={song.id}>
                        <div className="song-main">
                          <div className="song-title">{song.title}</div>
                          {(song.artist || song.cue || song.notes) && (
                            <div className="song-sub">
                              {[song.artist, song.cue, song.notes].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          {song.link && (
                            <a className="small" href={song.link} target="_blank" rel="noreferrer">
                              Listen
                            </a>
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
                      <SlotPicker
                        single={category.single}
                        hasSongs={list.length > 0}
                        recommendations={recommendations}
                      />
                    </form>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <form action={clientSubmitPlan}>
        <input type="hidden" name="token" value={token} />

        <div className="planner-section-head">
          <h2>Your entrances</h2>
          <p className="faint small">
            The order the wedding party comes into the reception, and who&rsquo;s in each one — so
            your DJ announces the right names in the right order.
          </p>
        </div>
        <div className="card planner-section">
          <div className="card-body">
            <RowEditor
              addLabel="Add another entrance"
              columns={[
                { name: "entrance_role", label: "Who", placeholder: "e.g. Bridesmaids, Groom + parents", width: "40%" },
                { name: "entrance_names", label: "Names", placeholder: "Names to announce" },
              ]}
              initial={entrance.map((e) => ({ entrance_role: e.role, entrance_names: e.names ?? "" }))}
            />
          </div>
        </div>

        <div className="planner-section-head">
          <h2>Speeches</h2>
          <p className="faint small">
            Who&rsquo;s speaking and roughly when. A walk-up song is optional — plenty of couples give
            each speaker their own.
          </p>
        </div>
        <div className="card planner-section">
          <div className="card-body">
            <RowEditor
              addLabel="Add another speech"
              columns={[
                { name: "speech_who", label: "Who", placeholder: "e.g. Best man — Jacob", width: "28%" },
                { name: "speech_when", label: "When", placeholder: "e.g. after mains", width: "18%" },
                { name: "speech_song", label: "Walk-up song", placeholder: "Walk-up song (optional)" },
                { name: "speech_cue", label: "Cue", placeholder: "e.g. from start", width: "18%" },
              ]}
              initial={speechRows.map((s) => ({
                speech_who: s.who,
                speech_when: s.when_text ?? "",
                speech_song: [s.song_title, s.song_artist].filter(Boolean).join(" — "),
                speech_cue: s.song_cue ?? "",
              }))}
            />
          </div>
        </div>

        <div className="planner-section-head">
          <h2>A few questions</h2>
          <p className="faint small">The things your DJ would otherwise have to email you about.</p>
        </div>

        <div className="card planner-section">
          <div className="card-head">
            <h3>Music</h3>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="preferred_genres">Favourite genres / artists</label>
              <input id="preferred_genres" name="preferred_genres" type="text" defaultValue={q?.preferred_genres ?? ""} placeholder="e.g. upbeat country, 2000s bangers, Motown" />
            </div>
            <div className="field">
              <label htmlFor="avoid_genres">Anything to steer clear of?</label>
              <input id="avoid_genres" name="avoid_genres" type="text" defaultValue={q?.avoid_genres ?? ""} placeholder="e.g. no heavy metal, minimal wedding cheese" />
            </div>
            <div className="field">
              <label htmlFor="vibe_notes">Mood / vibe you&rsquo;re picturing</label>
              <textarea id="vibe_notes" name="vibe_notes" rows={4} defaultValue={q?.vibe_notes ?? ""} placeholder="Formal or loose? Big dance party or background music? Anything that matters to you." />
            </div>
            <div className="field">
              <label htmlFor="request_policy">Guest request policy</label>
              <input id="request_policy" name="request_policy" type="text" defaultValue={q?.request_policy ?? ""} placeholder="e.g. requests welcome, but check with us first" />
              <span className="help">Say it however you like — your DJ follows this exactly.</span>
            </div>
            <div className="field">
              <label htmlFor="dedications">Dedications</label>
              <textarea id="dedications" name="dedications" rows={2} defaultValue={q?.dedications ?? ""} placeholder="A song for someone in particular, and who it's for." />
            </div>

            <div className="fieldset-title">Playlists, if you&rsquo;d rather hand one over</div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="playlist_pre_ceremony">Pre-ceremony</label>
                <input id="playlist_pre_ceremony" name="playlist_pre_ceremony" type="text" defaultValue={q?.playlist_pre_ceremony ?? ""} placeholder="Playlist link" />
              </div>
              <div className="field">
                <label htmlFor="playlist_cocktail">Cocktail hour</label>
                <input id="playlist_cocktail" name="playlist_cocktail" type="text" defaultValue={q?.playlist_cocktail ?? ""} placeholder="Playlist link" />
              </div>
              <div className="field">
                <label htmlFor="playlist_dinner">Dinner</label>
                <input id="playlist_dinner" name="playlist_dinner" type="text" defaultValue={q?.playlist_dinner ?? ""} placeholder="Playlist link" />
              </div>
              <div className="field">
                <label htmlFor="playlist_dance">Dance floor</label>
                <input id="playlist_dance" name="playlist_dance" type="text" defaultValue={q?.playlist_dance ?? ""} placeholder="Playlist link" />
              </div>
            </div>
          </div>
        </div>

        <div className="card planner-section">
          <div className="card-head">
            <h3>The day</h3>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="last_name_taken">Last name to be taken</label>
                <input id="last_name_taken" name="last_name_taken" type="text" defaultValue={q?.last_name_taken ?? ""} placeholder="How we announce you" />
              </div>
              <div className="field">
                <label htmlFor="mc_name">Who is your MC?</label>
                <input id="mc_name" name="mc_name" type="text" defaultValue={q?.mc_name ?? ""} placeholder="Name and number" />
              </div>
              <div className="field">
                <label htmlFor="bridesmaids">How many bridesmaids?</label>
                <input id="bridesmaids" name="bridesmaids" type="text" defaultValue={q?.bridesmaids ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="groomsmen">How many groomsmen?</label>
                <input id="groomsmen" name="groomsmen" type="text" defaultValue={q?.groomsmen ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="mic_needs">Who needs a microphone?</label>
                <input id="mic_needs" name="mic_needs" type="text" defaultValue={q?.mic_needs ?? ""} placeholder="e.g. officiant, three toasts, a reading" />
              </div>
              <div className="field">
                <label htmlFor="contact_on_day">Who do we call on the day?</label>
                <input id="contact_on_day" name="contact_on_day" type="text" defaultValue={q?.contact_on_day ?? ""} placeholder="Usually not the couple" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="announcements">Announcements &amp; tricky pronunciations</label>
              <textarea id="announcements" name="announcements" rows={3} defaultValue={q?.announcements ?? ""} placeholder="Names to say carefully, shuttle times, anything to announce." />
            </div>
          </div>
        </div>

        <div className="card planner-section">
          <div className="card-head">
            <h3>For the DJ&rsquo;s setup</h3>
            <div className="faint small">Boring but it saves a scramble on the day.</div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="arrival_time">What time can we get in?</label>
                <input id="arrival_time" name="arrival_time" type="text" defaultValue={q?.arrival_time ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="venue_phone">Venue phone number</label>
                <input id="venue_phone" name="venue_phone" type="text" defaultValue={q?.venue_phone ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="coordinator_email">Planner / coordinator email</label>
                <input id="coordinator_email" name="coordinator_email" type="text" defaultValue={q?.coordinator_email ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="outdoor_portions">Any part of the day outside?</label>
                <input id="outdoor_portions" name="outdoor_portions" type="text" defaultValue={q?.outdoor_portions ?? ""} placeholder="Which parts" />
              </div>
              <div className="field">
                <label htmlFor="table_reserved">6ft table reserved for the DJ?</label>
                <input id="table_reserved" name="table_reserved" type="text" defaultValue={q?.table_reserved ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="space_reserved">10&rsquo;x10&rsquo; space reserved?</label>
                <input id="space_reserved" name="space_reserved" type="text" defaultValue={q?.space_reserved ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="power_each_space">Power in each space?</label>
                <input id="power_each_space" name="power_each_space" type="text" defaultValue={q?.power_each_space ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="uplight_colours">Uplight colours</label>
                <input id="uplight_colours" name="uplight_colours" type="text" defaultValue={q?.uplight_colours ?? ""} placeholder="If you booked them" />
              </div>
              <div className="field">
                <label htmlFor="photobooth_hours">Photo booth hours</label>
                <input id="photobooth_hours" name="photobooth_hours" type="text" defaultValue={q?.photobooth_hours ?? ""} placeholder="If you booked one" />
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" type="submit">
          {event.plan_submitted_at ? "Save changes" : "Send this to our DJ"}
        </button>
      </form>

      <p className="small faint" style={{ textAlign: "center", marginTop: "2rem" }}>
        This link is private to you. Keep it handy — you can come back and change anything up to the
        day.
      </p>
    </main>
  );
}
