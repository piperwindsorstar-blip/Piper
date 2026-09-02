import Link from "next/link";
import { needed, rentalsDue } from "@/lib/dispatch";
import { showsOutTabs } from "@/lib/shows-out";
import { formatDate, formatDateShort, todayIso } from "@/lib/dates";
import ShowsOut from "@/components/ShowsOut";

/**
 * Shows out, on the dashboard.
 *
 * The dashboard is the page people leave open, so this is the half of dispatch
 * worth putting there: what is out — today, tomorrow, or across the week — what
 * is about to be late back, and any day somebody has flagged as needing a
 * vehicle without booking one. Planning a month happens on the board;
 * noticing that a hire was due yesterday has to happen wherever you already
 * are.
 *
 * The calls are drawn with the same card and the same tabs as the office
 * board, so the dashboard, the board and the yard are showing one thing rather
 * than three versions of it.
 *
 * Admin-only at the caller — vehicles and hire dates are office business.
 */
export default function DispatchToday() {
  const today = todayIso();
  const due = rentalsDue(today, 7);
  const overdue = due.filter((v) => v.rental_due && v.rental_due < today);

  // A fortnight out, because a vehicle nobody has booked is only actionable
  // while there is still time to book one.
  const ahead = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const gaps = needed(today, ahead);

  const tabs = showsOutTabs(today);
  const anything = tabs.some((t) => t.days.some((d) => d.calls.length > 0));

  if (!anything && due.length === 0 && gaps.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Shows out</h2>
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

        <ShowsOut tabs={tabs} />

        {due.length > 0 && (
          <div
            className={overdue.length > 0 ? "alert alert-warn" : "small muted"}
            style={{ marginTop: "1rem" }}
          >
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
