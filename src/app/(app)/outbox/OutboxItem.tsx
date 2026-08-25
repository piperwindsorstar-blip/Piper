"use client";

import { useActionState, useState } from "react";
import { approveAndSend, discard, saveDraft, restore, type OutboxState } from "./actions";
import { KIND_LABELS, type OutboxRow } from "@/lib/mail-types";

const empty: OutboxState = {};

/**
 * One queued email: who it is going to, what it says, and the decision.
 *
 * The body is shown in full rather than truncated. The whole point of the
 * queue is that somebody reads the thing before a client does, and a preview
 * you have to expand is a preview nobody reads.
 */
export default function OutboxItem({
  item,
  eventLabel,
  canSend,
  readOnly = false,
}: {
  item: OutboxRow;
  eventLabel: string | null;
  canSend: boolean;
  /** Reading only: the buttons come off rather than bouncing. */
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [sendState, send, sending] = useActionState(approveAndSend, empty);
  const [draftState, save, saving] = useActionState(saveDraft, empty);

  const pending = item.status === "queued" || item.status === "failed";

  return (
    <article className={`mail mail-${item.status}`}>
      <header className="mail-head">
        <div>
          <span className="badge badge-accent">{KIND_LABELS[item.kind] ?? item.kind}</span>
          {item.status === "sent" && <span className="badge badge-confirmed">Sent</span>}
          {item.status === "failed" && <span className="badge badge-cancelled">Failed</span>}
          {item.status === "cancelled" && <span className="badge badge-plain">Discarded</span>}
        </div>
        {eventLabel && <span className="small muted">{eventLabel}</span>}
      </header>

      <dl className="mail-addr">
        <dt>To</dt>
        <dd>{item.to_addr}</dd>
        {item.cc_addr && (
          <>
            <dt>Cc</dt>
            <dd>{item.cc_addr}</dd>
          </>
        )}
      </dl>

      {editing ? (
        <form action={save} className="mail-edit">
          <input type="hidden" name="id" value={item.id} />
          <div className="field">
            <label htmlFor={`subject-${item.id}`}>Subject</label>
            <input id={`subject-${item.id}`} name="subject" defaultValue={item.subject} />
          </div>
          <div className="field">
            <label htmlFor={`body-${item.id}`}>Message</label>
            <textarea id={`body-${item.id}`} name="body" rows={16} defaultValue={item.body} />
          </div>
          {draftState.error && <p className="alert-error">{draftState.error}</p>}
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="mail-subject">{item.subject}</h3>
          <pre className="mail-body">{item.body}</pre>
        </>
      )}

      {item.error && item.status === "failed" && (
        <p className="alert-error mail-error">{item.error}</p>
      )}
      {sendState.error && <p className="alert-error mail-error">{sendState.error}</p>}

      {!editing && !readOnly && (
        <footer className="btn-row mail-foot">
          {pending && (
            <>
              <form action={send}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !canSend}>
                  {sending ? "Sending…" : item.status === "failed" ? "Try again" : "Send"}
                </button>
              </form>
              <button className="btn btn-sm" type="button" onClick={() => setEditing(true)}>
                Edit
              </button>
              <form action={discard}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn btn-sm btn-danger" type="submit">
                  Discard
                </button>
              </form>
            </>
          )}
          {item.status === "cancelled" && (
            <form action={restore}>
              <input type="hidden" name="id" value={item.id} />
              <button className="btn btn-sm" type="submit">
                Put back in the queue
              </button>
            </form>
          )}
        </footer>
      )}
    </article>
  );
}
