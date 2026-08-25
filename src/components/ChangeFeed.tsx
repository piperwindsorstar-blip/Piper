import Link from "next/link";
import { describeAction, type ChangeGroup } from "@/lib/activity";
import { formatStoredTimestamp } from "@/lib/dates";

/**
 * Changes to anything — bookings, staff records, venues, settings — as one
 * feed. The booking-only version lives in `History` and stays there: an
 * event's own page wants its own story without the surrounding noise.
 *
 * Admin-only at every caller. Values include internal notes and staff notes.
 */

/** Where a subject can be looked at, when it still exists. */
function subjectHref(group: ChangeGroup): string | null {
  if (group.subject_id === null) return null;
  switch (group.subject_type) {
    case "booking":
      return `/events/${group.subject_id}`;
    case "staff":
      return `/team/${group.subject_id}`;
    case "venue":
      return "/venues";
    case "vehicle":
      return "/dispatch/vehicles";
    case "rental":
      return "/rentals";
    default:
      return null;
  }
}

export default function ChangeFeed({
  groups,
  liveEventIds,
  showSubject = true,
  empty = "Nothing recorded yet.",
}: {
  groups: ChangeGroup[];
  liveEventIds?: Set<number>;
  showSubject?: boolean;
  empty?: string;
}) {
  if (groups.length === 0) return <div className="empty">{empty}</div>;

  return (
    <ol className="history">
      {groups.map((group) => {
        // Only bookings can be checked for existence here, and only when the
        // caller passed the set. Anything else is assumed to still be there.
        const deleted =
          group.subject_type === "booking" &&
          liveEventIds !== undefined &&
          group.subject_id !== null &&
          !liveEventIds.has(group.subject_id);
        const href = deleted ? null : subjectHref(group);

        return (
          <li key={group.key} className="history-item">
            <div className="history-head">
              <span className="history-what">{describeAction(group)}</span>
              <span className="history-who">{group.actor_label}</span>
              <time className="history-when" dateTime={group.at}>
                {formatStoredTimestamp(group.at)}
              </time>
            </div>

            {showSubject && (
              <div className="history-event">
                {href ? (
                  <Link href={href}>{group.subject_label}</Link>
                ) : (
                  <span className="muted">
                    {group.subject_label}
                    {deleted && " (deleted)"}
                  </span>
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
