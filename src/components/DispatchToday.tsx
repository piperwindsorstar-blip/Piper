import Link from "next/link";
import { rentalsDue, runsOn } from "@/lib/dispatch";
import { formatDate, todayIso } from "@/lib/dates";

/**
 * What is on the road today, on the dashboard.
 *
 * The dashboard is the page people leave open, so this is the half of dispatch
 * worth putting there: what is out right now, and what is about to be late
 * back. Planning a week happens on the board; noticing that a hire was due
 * yesterday has to happen wherever you already are.
 *
 * Admin-only at the caller — vehicles and hire dates are office business.
 */
export default function DispatchToday() {
  const today = todayIso();
  const out = runsOn(today);
  const due = rentalsDue(today, 7);
  const overdue = due.filter((v) => v.rental_due && v.rental_due < today);

  if (out.length === 0 && due.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>On the road today</h2>
        <Link className="btn btn-sm" href="/dispatch">
          Week board
        </Link>
      </div>

      <div className="card-body">
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
                  {run.driver_name ? ` · ${run.driver_name}` : ""}
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
