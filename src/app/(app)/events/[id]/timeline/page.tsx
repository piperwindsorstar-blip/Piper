import { timelineForEvent } from "@/lib/planning";
import { formatTime } from "@/lib/dates";
import {
  addTimelineAction,
  deleteTimelineAction,
  moveTimelineAction,
  seedTimelineAction,
  updateTimelineAction,
} from "../planning-actions";
import { loadEvent } from "../guard";

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await loadEvent(id);
  const items = timelineForEvent(event.id);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Reception timeline</h2>
            <div className="faint small">
              The running order you work from on the night. Times are optional — order is what matters.
            </div>
          </div>
          {items.length === 0 && (
            <form action={seedTimelineAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button className="btn btn-sm" type="submit">
                Start from standard order
              </button>
            </form>
          )}
        </div>

        <div className="card-body">
          {items.length === 0 ? (
            <div className="empty">
              No timeline yet. Start from the standard wedding running order, or add your own items
              below.
            </div>
          ) : (
            items.map((item, index) => (
              <details key={item.id} className="time-line" style={{ display: "block" }}>
                <summary style={{ listStyle: "none", cursor: "pointer" }}>
                  <div className="row-between">
                    <div style={{ display: "flex", gap: "0.9rem", alignItems: "baseline" }}>
                      <span className="time-stamp">{formatTime(item.start_time)}</span>
                      <span>
                        <strong>{item.title}</strong>
                        {item.notes && <div className="song-sub">{item.notes}</div>}
                      </span>
                    </div>
                    <div className="btn-row">
                      <form action={moveTimelineAction} className="inline-form">
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button className="btn btn-icon" type="submit" disabled={index === 0} aria-label="Move up">
                          ↑
                        </button>
                      </form>
                      <form action={moveTimelineAction} className="inline-form">
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          className="btn btn-icon"
                          type="submit"
                          disabled={index === items.length - 1}
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </form>
                      <span className="btn btn-icon">Edit</span>
                    </div>
                  </div>
                </summary>

                <form action={updateTimelineAction} style={{ padding: "0.75rem 0 0.25rem" }}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="id" value={item.id} />
                  <div className="form-grid cols-3" style={{ gap: "0 0.6rem" }}>
                    <div className="field" style={{ marginBottom: "0.6rem" }}>
                      <label>Time</label>
                      <input name="start_time" type="time" defaultValue={item.start_time ?? ""} />
                    </div>
                    <div className="field" style={{ marginBottom: "0.6rem" }}>
                      <label>Item</label>
                      <input name="title" type="text" defaultValue={item.title} required />
                    </div>
                    <div className="field" style={{ marginBottom: "0.6rem" }}>
                      <label>Notes</label>
                      <input name="notes" type="text" defaultValue={item.notes ?? ""} />
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-sm btn-primary" type="submit">
                      Save
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      type="submit"
                      formAction={deleteTimelineAction}
                    >
                      Remove
                    </button>
                  </div>
                </form>
              </details>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Add an item</h2>
        </div>
        <div className="card-body">
          <form action={addTimelineAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <div className="form-grid cols-3" style={{ gap: "0 0.6rem" }}>
              <div className="field">
                <label htmlFor="new_time">Time</label>
                <input id="new_time" name="start_time" type="time" />
              </div>
              <div className="field">
                <label htmlFor="new_title">Item *</label>
                <input id="new_title" name="title" type="text" placeholder="e.g. Anniversary dance" required />
              </div>
              <div className="field">
                <label htmlFor="new_notes">Notes</label>
                <input id="new_notes" name="notes" type="text" placeholder="Cue, who's on mic…" />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              Add to timeline
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
