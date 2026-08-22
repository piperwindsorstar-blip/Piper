import Link from "next/link";
import { needed, rentalsDue, runsOn } from "@/lib/dispatch";
import { COMMITTED } from "@/lib/dispatch-types";
import { formatDate, formatDateShort, todayIso } from "@/lib/dates";

/**
 * What is on the road today, on the dashboard.
 *
 * The dashboard is the page people leave open, so this is the half of dispatch
 * worth putting there: what is out right now, what is about to be late back,
 * and any day somebody has flagged as needing a vehicle without booking one.
 * Planning a month happens on the board; noticing that a hire was due
 * yesterday has to happen wherever you already are.
 *
 * Admin-only at the caller — vehicles and hire dates are office business.
 */
export default function DispatchToday() {
  const today = todayIso();
  const out = runsOn(today).filter((r) => COMMITTED.includes(r.status));
  const due = rentalsDue(today, 7);
  const overdue = due.filter((v) => v.rental_due && v.rental_due < today);

  // A fortnight out, because a vehicle nobody has booked is only actionable
  // while there is still time to book one.
  const ahead = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const gaps = needed(today, ahead);

  if (out.length === 0 && due.length === 0 && gaps.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>On the road today</h2>
        <Link className="btn btn-sm" href="/dispatch">
          Dispatch board
        </Link>
      </div>

      <div className="card-body">
        {gaps.length > 0 && (
          <div className="alert alert-warn">
            <strong>Needed, not booked:</strong>{" "}
            {gaps
              .map((g) => `${g.vehicle_name} on ${formatDateShort(g.starts_on)}`)
              .join(", ")}
          </div>
        )}

        {out.length === 0 ? (
          <p className="small muted" style={{ marginBottom: due.length ? "0.75rem" : 0 }}>
            Nothing booked out today.
          </p>
        ) : (
          <ul className="stack-list" style={{ marginBottom: due.length ? "1rem" : 0 }}>
            {out.map((run) => (
              <li key={run.id}>
                <strong>{run.vehicle_name}</strong>{" "}
                {run.event_id ? (
                  <Link href={`/events/${run.event_id}`}>{run.label}</Link>
                ) : (
                  <span>{run.label}</span>
                )}
                <span className="muted small">
                  {run.meet_time ? ` · meet ${run.meet_time}` : ""}
                  {run.crew ? ` · ${run.crew}` : run.driver_name ? ` · ${run.driver_name}` : ""}
                  {run.keys_with ? ` · keys with ${run.keys_with}` : ""}
                  {run.ends_on !== today ? ` · back ${formatDate(run.ends_on)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        {due.length > 0 && (
          <div className={overdue.length > 0 ? "alert alert-warn" : "small muted"}>
            {overdue.length > 0 ? (
              <>
                <strong>Overdue:</strong>{" "}
                {overdue.map((v) => `${v.name} (${formatDate(v.rental_due as string)})`).join(", ")}
              </>
            ) : (
              <>
                Due back this week:{" "}
                {due.map((v) => `${v.name} on ${formatDate(v.rental_due as string)}`).join(", ")}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
