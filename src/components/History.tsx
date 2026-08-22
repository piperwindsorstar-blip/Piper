import Link from "next/link";
import { ACTION_LABELS, type AuditGroup } from "@/lib/audit";
import { formatStoredTimestamp } from "@/lib/dates";

/**
 * Renders a booking's history. Admin-only at every caller — the field values
 * include the internal notes.
 *
 * `showEvent` adds which booking each entry belongs to, for the activity page;
 * on a single event's own page that would repeat the heading on every row.
 */
export default function History({
  groups,
  showEvent = false,
  liveEventIds,
  empty = "Nothing recorded yet.",
}: {
  groups: AuditGroup[];
  showEvent?: boolean;
  liveEventIds?: Set<number>;
  empty?: string;
}) {
  if (groups.length === 0) {
    return <div className="empty">{empty}</div>;
  }

  return (
    <ol className="history">
      {groups.map((group) => {
        const stillExists = liveEventIds ? liveEventIds.has(group.event_id) : true;
        return (
          <li key={group.key} className="history-item">
            <div className="history-head">
              <span className="history-what">{ACTION_LABELS[group.action]}</span>
              <span className="history-who">{group.actor_label}</span>
              <time className="history-when" dateTime={group.at}>
                {formatStoredTimestamp(group.at)}
              </time>
            </div>

            {showEvent && (
              <div className="history-event">
                {stillExists ? (
                  <Link href={`/events/${group.event_id}`}>{group.event_label}</Link>
                ) : (
                  <span className="muted">{group.event_label} (deleted)</span>
                )}
              </div>
            )}

            {group.changes.length > 0 && (
              <ul className="history-changes">
                {group.changes.map((change) => (
                  <li key={change.field}>
                    <span className="history-field">{change.field}</span>
                    <span className="history-from">{change.old_value ?? "empty"}</span>
                    <span className="history-arrow" aria-label="changed to">
                      →
                    </span>
                    <span className="history-to">{change.new_value ?? "empty"}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
