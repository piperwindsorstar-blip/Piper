import SongList from "./SongList";
import AddSongFields from "./AddSongFields";
import { entranceOrder, getQuestionnaire, songsByCategory, speeches } from "@/lib/planning";
import { SONG_CATEGORIES, SONG_SECTIONS } from "@/lib/types";
import { addSongAction } from "../planning-actions";
import { loadEvent } from "../guard";

export default async function MusicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await loadEvent(id);

  const songs = songsByCategory(event.id);
  const questionnaire = getQuestionnaire(event.id);
  const entrance = entranceOrder(event.id);
  const speechRows = speeches(event.id);

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
                <div className="meta-value">{questionnaire.request_policy || "—"}</div>
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
            {(questionnaire.table_reserved || questionnaire.power_each_space ||
              questionnaire.outdoor_portions || questionnaire.arrival_time) && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Setup</div>
                <div className="meta-list">
                  <div className="meta-item">
                    <div className="meta-label">Access from</div>
                    <div className="meta-value">{questionnaire.arrival_time || "—"}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-label">Table / space</div>
                    <div className="meta-value">
                      {[questionnaire.table_reserved, questionnaire.space_reserved]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-label">Power</div>
                    <div className="meta-value">{questionnaire.power_each_space || "—"}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-label">Outdoors</div>
                    <div className="meta-value">{questionnaire.outdoor_portions || "—"}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-label">MC</div>
                    <div className="meta-value">{questionnaire.mc_name || "—"}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-label">Announced as</div>
                    <div className="meta-value">{questionnaire.last_name_taken || "—"}</div>
                  </div>
                </div>
              </div>
            )}
            {questionnaire.dedications && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Dedications</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {questionnaire.dedications}
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

      {entrance.length > 0 && (
        <div className="card" style={{ marginTop: "1.1rem" }}>
          <div className="card-head">
            <h2>Grand entrance order</h2>
            <span className="badge badge-plain">{entrance.length}</span>
          </div>
          <div className="card-body tight">
            {entrance.map((row, i) => (
              <div className="song-line" key={row.id}>
                <span className="time-stamp">{i + 1}</span>
                <div className="song-main">
                  <div className="song-title">{row.role}</div>
                  {row.names && <div className="song-sub">{row.names}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {speechRows.length > 0 && (
        <div className="card" style={{ marginTop: "1.1rem" }}>
          <div className="card-head">
            <h2>Speeches</h2>
            <span className="badge badge-plain">{speechRows.length}</span>
          </div>
          <div className="card-body tight">
            {speechRows.map((row) => (
              <div className="song-line" key={row.id}>
                <div className="song-main">
                  <div className="song-title">
                    {row.who}
                    {row.when_text && <span className="faint small"> · {row.when_text}</span>}
                  </div>
                  {row.song_title && (
                    <div className="song-sub">
                      Walk-up: {row.song_title}
                      {row.song_artist ? ` — ${row.song_artist}` : ""}
                      {row.song_cue && (
                        <strong style={{ color: "var(--accent-text)" }}> · {row.song_cue}</strong>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                  <SongList songs={list} eventId={event.id} category={category.key} />
                </div>
              )}

              <form action={addSongAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="category" value={category.key} />
                <AddSongFields submitLabel={category.single && list.length ? "Replace" : "Add"} />
              </form>
            </div>
          </div>
        );
      })}
    </>
  );
}
