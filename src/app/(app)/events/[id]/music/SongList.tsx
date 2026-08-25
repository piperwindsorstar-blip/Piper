"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Song } from "@/lib/types";
import { deleteSongAction, reorderSongsAction } from "../planning-actions";

/**
 * One slot's songs, reorderable by dragging.
 *
 * Order is the point of this list. "Must play" is a set of songs the couple
 * wants heard; the ceremony slots are a sequence somebody walks down an aisle
 * to. Reordering by clicking an arrow four times is how a list of eight ends
 * up in whatever order it was typed in.
 *
 * Pointer events rather than HTML5 drag-and-drop, because the office does this
 * on a phone as often as a laptop and HTML5 dragging does not exist on touch.
 * The arrows stay: they are the keyboard path, and they are what works when
 * somebody is wearing gloves in a warehouse in February.
 */

export type SongListProps = {
  songs: Song[];
  eventId: number;
  category: string;
};

export default function SongList({ songs, eventId, category }: SongListProps) {
  // The order on screen, which leads the server while a drag is in flight.
  const [order, setOrder] = useState<Song[]>(songs);
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startSaving] = useTransition();

  const rows = useRef(new Map<number, HTMLDivElement>());
  const settled = useRef(true);

  // A save from another tab, or an added song, arrives as new props. Taking
  // them mid-drag would yank the row out from under the finger, so it waits.
  useEffect(() => {
    if (settled.current) setOrder(songs);
  }, [songs]);

  // The live order and the row being dragged, as refs. The window listeners
  // below are registered once per drag and would otherwise close over whatever
  // the state happened to be when the drag started.
  const liveOrder = useRef<Song[]>(songs);
  useEffect(() => {
    liveOrder.current = order;
  }, [order]);

  function moveTo(id: number, toIndex: number) {
    setOrder((current) => {
      const from = current.findIndex((s) => s.id === id);
      if (from === -1 || from === toIndex || toIndex < 0 || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  /** The row the pointer is over, by the box of each row on screen. */
  function indexAt(clientY: number): number | null {
    let found: number | null = null;
    liveOrder.current.forEach((song, i) => {
      const el = rows.current.get(song.id);
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (clientY >= box.top && clientY <= box.bottom) found = i;
    });
    return found;
  }

  function save(ids: number[]) {
    if (ids.join(",") === songs.map((s) => s.id).join(",")) {
      settled.current = true;
      return;
    }
    const form = new FormData();
    form.set("event_id", String(eventId));
    form.set("category", category);
    form.set("ids", ids.join(","));
    startSaving(async () => {
      await reorderSongsAction(form);
      settled.current = true;
    });
  }

  /*
   * Listeners on the window rather than pointer capture on the handle.
   *
   * Capture looks like the right tool and is not: reordering moves the row's
   * DOM node, Chromium treats that as the capturing element leaving the
   * document, and it fires lostpointercapture — so the drag dies on the first
   * row it passes. The board solved the same problem the same way.
   */
  function onHandleDown(event: React.PointerEvent, id: number) {
    event.preventDefault();
    settled.current = false;
    setDragging(id);

    const move = (e: PointerEvent) => {
      const over = indexAt(e.clientY);
      if (over !== null) moveTo(id, over);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(null);
      save(liveOrder.current.map((s) => s.id));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /** Arrow keys on the handle, so this is not a mouse-only feature. */
  function onHandleKey(event: React.KeyboardEvent, id: number) {
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (delta === 0) return;
    event.preventDefault();

    const from = order.findIndex((s) => s.id === id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;

    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    liveOrder.current = next;
    settled.current = false;
    save(next.map((s) => s.id));
  }

  return (
    <div className="song-list">
      {order.map((song, index) => (
        <div
          className={`song-line${dragging === song.id ? " song-line-dragging" : ""}`}
          key={song.id}
          ref={(el) => {
            if (el) rows.current.set(song.id, el);
            else rows.current.delete(song.id);
          }}
        >
          {order.length > 1 && (
            <button
              type="button"
              className="song-grip"
              aria-label={`Move ${song.title} — currently ${index + 1} of ${order.length}`}
              title="Drag to reorder, or use the arrow keys"
              onPointerDown={(e) => onHandleDown(e, song.id)}
              onKeyDown={(e) => onHandleKey(e, song.id)}
            >
              ⠿
            </button>
          )}

          <div className="song-main">
            <div className="song-title">
              {song.title}
              {song.source === "client" && (
                <span className="badge badge-accent" style={{ marginLeft: "0.5rem" }}>
                  From couple
                </span>
              )}
            </div>
            {(song.artist || song.cue || song.notes) && (
              <div className="song-sub">
                {[song.artist, song.notes].filter(Boolean).join(" · ")}
                {song.cue && (
                  <>
                    {(song.artist || song.notes) && " · "}
                    <strong style={{ color: "var(--accent-text)" }}>{song.cue}</strong>
                  </>
                )}
              </div>
            )}
            {song.link && (
              <a className="small" href={song.link} target="_blank" rel="noreferrer">
                Listen
              </a>
            )}
          </div>

          <div className="btn-row">
            <form action={deleteSongAction} className="inline-form">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="id" value={song.id} />
              <button className="btn btn-icon btn-danger" type="submit" aria-label="Remove song">
                ✕
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
