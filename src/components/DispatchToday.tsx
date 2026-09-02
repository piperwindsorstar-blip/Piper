import Link from "next/link";
import { groupCalls, needed, rentalsDue, runsOn } from "@/lib/dispatch";
import { COMMITTED } from "@/lib/dispatch-types";
import { formatDate, formatDateShort, todayIso } from "@/lib/dates";
import CallCard from "@/components/CallCard";

/**
 * What is on the road today, on the dashboard.
 *
 * The dashboard is the page people leave open, so this is the half of dispatch
 * worth putting there: what is out right now, what is about to be late back,
 * and any day somebody has flagged as needing a vehicle without booking one.
 * Planning a month happens on the board; noticing that a hire was due
 * yesterday has to happen wherever you already are.
 *
 * The calls are drawn with the same card the two dispatch boards use, so the
 * dashboard, the office board and the yard are all showing one thing rather
 * than three versions of it.
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

  const calls = groupCalls(
    out.map((run) => ({
      runId: run.id,
      label: run.label,
      status: run.status,
      meet: run.meet_time,
      site: run.site,
      crew: run.crew ?? run.driver_name,
      keys: run.keys_with,
      endsOn: run.ends_on,
      eventId: run.event_id,
      vehicleId: run.vehicle_id,
      vehicleName: run.vehicle_name,
      vehicleClass: run.vehicle_class,
    })),
  );

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
            <strong>Needed in the next fortnight, not booked:</strong>{" "}
            {gaps
              .map((g) => `${g.vehicle_name} on ${formatDateShort(g.starts_on)}`)
              .join(", ")}
          </div>
        )}

        {calls.length === 0 ? (
          <p className="today-empty" style={{ marginBottom: due.length ? "0.75rem" : 0 }}>
            No vehicles out. Shop day.
          </p>
        ) : (
          <div className="today-calls" style={{ marginBottom: due.length ? "1rem" : 0 }}>
            {calls.map((call) => (
              <CallCard key={call.key} call={call} today={today} linkEvents />
            ))}
          </div>
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
