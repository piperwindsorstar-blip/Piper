"use client";

import { useActionState, useState } from "react";
import { BOARD_NOTE_MAX, PUBLIC_DAYS, type PublicBoard } from "@/lib/settings-types";
import { saveBoard, type SettingsState } from "./actions";

/**
 * The switch that publishes the crew board.
 *
 * It says out loud what turning it on means. Every other page in Piper is
 * behind a login; this one is readable by anyone who has the address, and the
 * run labels on it are whatever the office typed — which, for a run created
 * from a booking, starts life as the couple's names.
 */
export default function PublicBoardForm({
  board,
  origin,
}: {
  board: PublicBoard;
  origin: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveBoard, {});
  const [on, setOn] = useState(board.on);
  const [note, setNote] = useState(board.note);

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <p className="small muted">
        Publishes a read-only board at <code>{origin}/board</code> showing today and the
        next {PUBLIC_DAYS - 1} days. No sign-in, no way to look further ahead, and nothing
        on it links back into Piper.
      </p>

      <div className="field">
        <label htmlFor="board_on">Published</label>
        <label className="check-row">
          <input
            id="board_on"
            name="on"
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          />
          <span>Anyone with the address can read the board</span>
        </label>
      </div>

      <div className="field">
        <label htmlFor="note">Note at the top</label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={BOARD_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Keys are in the lock box. Call the shop before 7am."
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : on ? "Publish the board" : "Save"}
      </button>

      {on && (
        <div className="alert alert-warn" style={{ marginTop: "1rem" }}>
          <strong>What goes out:</strong> vehicle names, what each is out for, meet times,
          crew, city and who has the keys. A run created from a booking starts with the
          couple&rsquo;s names as its label — retype it on the board if you would rather
          those weren&rsquo;t public. Plates, internal notes and hire paperwork never
          appear.
        </div>
      )}
    </form>
  );
}
