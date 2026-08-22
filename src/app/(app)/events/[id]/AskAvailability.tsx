"use client";

import { useActionState } from "react";
import { askDj, type AskState } from "./availability-actions";
import { formatStoredTimestamp } from "@/lib/dates";
import type { AvailabilityWithDj } from "@/lib/availability";

const LABELS: Record<string, { text: string; className: string }> = {
  asked: { text: "Waiting", className: "badge-tentative" },
  available: { text: "Can do it", className: "badge-confirmed" },
  unavailable: { text: "Can't make it", className: "badge-cancelled" },
};

/**
 * Asking DJs whether they can work a date, and what they said.
 *
 * Several DJs can be asked at once — the point is to find out who is free
 * before committing anyone, so this deliberately does not assign anybody.
 * Assigning stays a separate, deliberate act on the edit page.
 */
export default function AskAvailability({
  eventId,
  djs,
  requests,
}: {
  eventId: number;
  djs: { id: number; name: string }[];
  requests: AvailabilityWithDj[];
}) {
  const [state, ask, asking] = useActionState(askDj, {} as AskState);

  const alreadyAsked = new Set(requests.map((r) => r.dj_id));
  const unasked = djs.filter((d) => !alreadyAsked.has(d.id));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Who&rsquo;s free?</h2>
        <span className="small muted">Ask before you assign</span>
      </div>

      <div className="card-body">
        {requests.length === 0 ? (
          <p className="small muted">
            Nobody asked yet. Pick a DJ and Piper will draft the email for you.
          </p>
        ) : (
          <ul className="avail-list">
            {requests.map((r) => {
              const label = LABELS[r.status] ?? LABELS.asked;
              return (
                <li key={r.id}>
                  <span className="avail-name">{r.dj_name}</span>
                  <span className={`badge ${label.className}`}>{label.text}</span>
                  {r.note && <span className="small muted avail-note">&ldquo;{r.note}&rdquo;</span>}
                  <span className="small faint avail-when">
                    {r.responded_at
                      ? `answered ${formatStoredTimestamp(r.responded_at)}`
                      : `asked ${formatStoredTimestamp(r.asked_at)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {state.error && <p className="alert-error">{state.error}</p>}
        {state.ok && <p className="alert-ok">{state.ok}</p>}

        <form action={ask} className="avail-ask">
          <input type="hidden" name="event_id" value={eventId} />
          <div className="field">
            <label htmlFor="dj_id">Ask a DJ</label>
            <select id="dj_id" name="dj_id" required defaultValue="">
              <option value="" disabled>
                Choose someone…
              </option>
              {unasked.map((dj) => (
                <option key={dj.id} value={dj.id}>
                  {dj.name}
                </option>
              ))}
              {requests.length > 0 && (
                <optgroup label="Ask again">
                  {djs
                    .filter((d) => alreadyAsked.has(d.id))
                    .map((dj) => (
                      <option key={dj.id} value={dj.id}>
                        {dj.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
          <button className="btn btn-sm" type="submit" disabled={asking}>
            {asking ? "Asking…" : "Ask if they're free"}
          </button>
        </form>
      </div>
    </div>
  );
}
