"use client";

import { useActionState } from "react";
import { recordAnswer, type AnswerState } from "./actions";

/**
 * Yes or no, plus an optional note.
 *
 * `preset` comes from the ?answer= in the emailed link, so tapping "Yes, I can
 * do it" in the email lands here with the choice already made — one more tap
 * to confirm, and a chance to add a note. It is not recorded on page load:
 * mail clients and link scanners fetch URLs on their own, and an answer that
 * a spam filter can submit is not an answer.
 */
export default function AnswerForm({
  token,
  preset,
  again = false,
}: {
  token: string;
  preset?: "available" | "unavailable";
  again?: boolean;
}) {
  const [state, submit, pending] = useActionState(recordAnswer, {} as AnswerState);

  return (
    <form action={submit} className="avail-form">
      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="note">Anything to add? (optional)</label>
        <input
          id="note"
          name="note"
          placeholder="e.g. free after 3pm, or already booked that weekend"
        />
      </div>

      {state.error && <p className="alert-error">{state.error}</p>}

      <div className="btn-row avail-buttons">
        <button
          className={`btn ${preset === "available" || !preset ? "btn-primary" : ""}`}
          name="answer"
          value="available"
          type="submit"
          disabled={pending}
        >
          {again ? "Actually, I can do it" : "Yes, I can do it"}
        </button>
        <button
          className={`btn ${preset === "unavailable" ? "btn-primary" : ""}`}
          name="answer"
          value="unavailable"
          type="submit"
          disabled={pending}
        >
          {again ? "Actually, I can't" : "Sorry, I can't"}
        </button>
      </div>
    </form>
  );
}
