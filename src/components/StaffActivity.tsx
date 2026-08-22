import {
  groupChanges,
  REASON_LABELS,
  type ChangeRow,
  type SignInRow,
} from "@/lib/activity";
import { formatStoredTimestamp } from "@/lib/dates";
import ChangeFeed from "./ChangeFeed";

/**
 * One person's activity: when they signed in, and what they changed.
 *
 * The two halves answer different questions and are kept apart rather than
 * interleaved — "were they working on the 14th" and "who edited this booking"
 * are not the same enquiry, and a merged list serves neither well.
 *
 * Admin-only. Change rows carry field values, internal notes among them.
 */
export default function StaffActivity({
  signIns,
  changes,
  liveEventIds,
}: {
  signIns: SignInRow[];
  changes: ChangeRow[];
  liveEventIds?: Set<number>;
}) {
  const groups = groupChanges(changes);
  const failed = signIns.filter((s) => s.outcome === "failed").length;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Sign-ins</h2>
          <span className="small muted">
            {signIns.length === 0
              ? "None yet"
              : `Last ${signIns.length}${failed > 0 ? ` · ${failed} failed` : ""}`}
          </span>
        </div>

        {signIns.length === 0 ? (
          <div className="empty">They haven&rsquo;t signed in yet.</div>
        ) : (
          <ul className="signin-list">
            {signIns.map((row) => (
              <li key={row.id}>
                <time dateTime={row.at}>{formatStoredTimestamp(row.at)}</time>
                {row.outcome === "success" ? (
                  <span className="badge badge-confirmed">Signed in</span>
                ) : (
                  <span className="badge badge-cancelled">
                    {row.reason ? (REASON_LABELS[row.reason] ?? "Failed") : "Failed"}
                  </span>
                )}
                <span className="small faint">{row.ip ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>What they changed</h2>
          <span className="small muted">Newest first</span>
        </div>
        <ChangeFeed
          groups={groups}
          liveEventIds={liveEventIds}
          empty="They haven't changed anything yet."
        />
      </div>
    </>
  );
}
