import { getQuestionnaire, songsByCategory } from "@/lib/planning";
import { SONG_CATEGORIES, type Song } from "@/lib/types";
import { addSongAction, deleteSongAction, moveSongAction } from "../planning-actions";
import { loadEvent } from "../guard";

function SongRow({ song, eventId, list }: { song: Song; eventId: number; list: Song[] }) {
  const index = list.findIndex((s) => s.id === song.id);

  return (
    <div className="song-line">
      <div className="song-main">
        <div className="song-title">
          {song.title}
          {song.source === "client" && (
            <span className="badge badge-accent" style={{ marginLeft: "0.5rem" }}>
              From couple
            </span>
          )}
        </div>
        {(song.artist || song.notes) && (
          <div className="song-sub">
            {song.artist}
            {song.artist && song.notes ? " · " : ""}
            {song.notes}
          </div>
        )}
      </div>

      <div className="btn-row">
        {list.length > 1 && (
          <>
            <form action={moveSongAction} className="inline-form">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="id" value={song.id} />
              <input type="hidden" name="direction" value="up" />
              <button className="btn btn-icon" type="submit" disabled={index === 0} aria-label="Move up">
                ↑
              </button>
            </form>
            <form action={moveSongAction} className="inline-form">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="id" value={song.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                className="btn btn-icon"
                type="submit"
                disabled={index === list.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
            </form>
          </>
        )}
        <form action={deleteSongAction} className="inline-form">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="id" value={song.id} />
          <button className="btn btn-icon btn-danger" type="submit" aria-label="Remove song">
            ✕
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function MusicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await loadEvent(id);

  const songs = songsByCategory(event.id);
  const questionnaire = getQuestionnaire(event.id);

  return (
    <>
      {questionnaire && (
        <div className="card" style={{ marginBottom: "1.1rem" }}>
          <div className="card-head">
            <h2>What the couple told us</h2>
            {event.plan_submitted_at && <span className="badge badge-confirmed">Planner submitted</span>}
          </div>
          <div className="card-body">
            <div className="meta-list">
              <div className="meta-item">
                <div className="meta-label">Loves</div>
                <div className="meta-value">{questionnaire.preferred_genres || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Avoid</div>
                <div className="meta-value">{questionnaire.avoid_genres || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Guest requests</div>
                <div className="meta-value">
                  {questionnaire.takes_requests ? "Taking requests" : "No requests from the floor"}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Mic needs</div>
                <div className="meta-value">{questionnaire.mic_needs || "—"}</div>
              </div>
            </div>
            {questionnaire.vibe_notes && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Vibe</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {questionnaire.vibe_notes}
                </div>
              </div>
            )}
            {questionnaire.announcements && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Announcements &amp; pronunciations</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {questionnaire.announcements}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {SONG_CATEGORIES.map((category) => {
        const list = songs.get(category.key) ?? [];
        const isDoNotPlay = category.key === "do_not_play";

        return (
          <div className="card" key={category.key} style={{ marginTop: "1.1rem" }}>
            <div className="card-head">
              <div>
                <h2 style={isDoNotPlay ? { color: "var(--danger)" } : undefined}>{category.label}</h2>
                <div className="faint small">{category.hint}</div>
              </div>
              <span className="badge badge-plain">
                {category.single ? (list.length ? "Picked" : "Not picked") : `${list.length}`}
              </span>
            </div>

            <div className="card-body tight">
              {list.length === 0 ? (
                <div className="empty" style={{ padding: "0.9rem" }}>
                  Nothing here yet.
                </div>
              ) : (
                <div style={{ marginBottom: "0.75rem" }}>
                  {list.map((song) => (
                    <SongRow key={song.id} song={song} eventId={event.id} list={list} />
                  ))}
                </div>
              )}

              <form action={addSongAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="category" value={category.key} />
                <div className="form-grid cols-3" style={{ gap: "0 0.6rem" }}>
                  <div className="field" style={{ marginBottom: "0.6rem" }}>
                    <input name="title" type="text" placeholder="Song title" required />
                  </div>
                  <div className="field" style={{ marginBottom: "0.6rem" }}>
                    <input name="artist" type="text" placeholder="Artist" />
                  </div>
                  <div className="field" style={{ marginBottom: "0.6rem" }}>
                    <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                      <input name="notes" type="text" placeholder="Note (version, cue…)" />
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
    </>
  );
}
