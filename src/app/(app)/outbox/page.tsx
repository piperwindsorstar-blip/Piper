import { requireAdmin } from "@/lib/auth";
import { listOutbox, mailIsConfigured, type OutboxRow } from "@/lib/mail";
import { getEventRaw } from "@/lib/events";
import { eventLabel } from "@/lib/audit";
import OutboxItem from "./OutboxItem";
import MailStatus from "./MailStatus";

/**
 * Everything Piper has written, and what became of it.
 *
 * Piper never sends on its own — each email waits here until an admin reads it
 * and taps send. The cost is a step; the benefit is that a booking typed with
 * the wrong address, or a test event, cannot reach a real couple.
 */
export default async function OutboxPage() {
  await requireAdmin();

  const all = listOutbox("all", 200);
  const waiting = all.filter((m) => m.status === "queued" || m.status === "failed");
  const done = all.filter((m) => m.status === "sent" || m.status === "cancelled");
  const configured = mailIsConfigured();

  // Resolve each event's label once rather than per row.
  const labels = new Map<number, string>();
  for (const item of all) {
    if (item.event_id === null || labels.has(item.event_id)) continue;
    const event = getEventRaw(item.event_id);
    if (event) labels.set(item.event_id, eventLabel(event));
  }

  const labelFor = (item: OutboxRow) =>
    item.event_id === null ? null : labels.get(item.event_id) ?? "Deleted booking";

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Outbox</h1>
          <div className="topbar-sub">
            Piper writes the emails · you decide what goes out
          </div>
        </div>
      </header>

      <div className="content">
        <MailStatus configured={configured} />

        <div className="card">
          <div className="card-head">
            <h2>Waiting for you</h2>
            <span className="small muted">
              {waiting.length === 0
                ? "Nothing waiting"
                : `${waiting.length} to review`}
            </span>
          </div>
          {waiting.length === 0 ? (
            <div className="empty">
              Nothing to send. Emails appear here when you create a booking or assign a DJ.
            </div>
          ) : (
            <div className="mail-list">
              {waiting.map((item) => (
                <OutboxItem
                  key={item.id}
                  item={item}
                  eventLabel={labelFor(item)}
                  canSend={configured}
                />
              ))}
            </div>
          )}
        </div>

        {done.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Already dealt with</h2>
              <span className="small muted">{done.length} sent or discarded</span>
            </div>
            <div className="mail-list">
              {done.map((item) => (
                <OutboxItem
                  key={item.id}
                  item={item}
                  eventLabel={labelFor(item)}
                  canSend={configured}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
