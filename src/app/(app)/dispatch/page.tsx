import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { listDjs } from "@/lib/team";
import {
  KIND_LABELS,
  listVehicles,
  rentalsDue,
  shiftWeek,
  uncoveredEvents,
  weekBoard,
  weekDays,
} from "@/lib/dispatch";
import { formatDate, formatDateShort, todayIso } from "@/lib/dates";
import RunForm from "./RunForm";
import { removeRun } from "./actions";

/**
 * The week, vehicle by vehicle.
 *
 * A vehicle out from Friday to Sunday fills all three cells rather than one,
 * because the question this page answers is "is that van free on Saturday" and
 * a run drawn only on its start date answers it wrongly.
 */
export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const admin = await requireAdmin();
  const { week } = await searchParams;

  const today = todayIso();
  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const days = weekDays(anchor);
  const vehicles = listVehicles();
  const board = weekBoard(days, vehicles);

  const uncovered = uncoveredEvents(days[0], days[6]);
  const due = rentalsDue(today);

  // Bookings worth offering in the picker: this week and the next few, so the
  // list stays short enough to scan.
  const soon = listEvents(admin, {}).filter(
    (e) => e.event_date >= days[0] && e.event_date <= shiftWeek(days[6], 6),
  );

  const couple = (e: (typeof soon)[number]) =>
    e.partner_two_name ? `${e.partner_one_name} & ${e.partner_two_name}` : e.partner_one_name;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            {formatDate(days[0])} – {formatDate(days[6])}
          </h2>
          <div className="btn-row">
            <Link className="btn btn-sm" href={`/dispatch?week=${shiftWeek(anchor, -1)}`}>
              ← Previous
            </Link>
            <Link className="btn btn-sm" href="/dispatch">
              This week
            </Link>
            <Link className="btn btn-sm" href={`/dispatch?week=${shiftWeek(anchor, 1)}`}>
              Next →
            </Link>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="empty">
            No vehicles yet. <Link href="/dispatch/vehicles">Add the fleet</Link> and the week
            fills in.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table board">
              <thead>
                <tr>
                  <th className="board-vehicle">Vehicle</th>
                  {days.map((day) => (
                    <th key={day} className={day === today ? "board-today" : undefined}>
                      {formatDateShort(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.map(({ vehicle, byDay }) => (
                  <tr key={vehicle.id}>
                    <th scope="row" className="board-vehicle">
                      <div>{vehicle.name}</div>
                      <div className="small faint">
                        {KIND_LABELS[vehicle.kind]}
                        {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                      </div>
                    </th>
                    {days.map((day) => {
                      const runs = byDay.get(day) ?? [];
                      return (
                        <td key={day} className={day === today ? "board-today" : undefined}>
                          {runs.map((run) => (
                            <div
                              key={run.id}
                              className={`run-chip${runs.length > 1 ? " run-chip-clash" : ""}`}
                            >
                              <div className="run-label">
                                {run.event_id ? (
                                  <Link href={`/events/${run.event_id}`}>{run.label}</Link>
                                ) : (
                                  run.label
                                )}
                              </div>
                              {run.driver_name && (
                                <div className="small faint">{run.driver_name}</div>
                              )}
                              {run.keys_with && (
                                <div className="small faint">Keys: {run.keys_with}</div>
                              )}
                              {/* Only on the first day it covers, or a
                                  three-day run would offer three identical
                                  remove buttons. */}
                              {run.starts_on === day && (
                                <form action={removeRun}>
                                  <input type="hidden" name="id" value={run.id} />
                                  <button className="run-remove" type="submit" aria-label="Remove run">
                                    ×
                                  </button>
                                </form>
                              )}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {due.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Rentals due back</h2>
            <span className="small muted">Next two weeks</span>
          </div>
          <div className="card-body">
            <ul className="stack-list">
              {due.map((v) => (
                <li key={v.id}>
                  <strong>{v.name}</strong> back by {formatDate(v.rental_due as string)}
                  {v.rental_due && v.rental_due < today && (
                    <span className="badge badge-cancelled" style={{ marginLeft: "0.4rem" }}>
                      Overdue
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {uncovered.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Nothing booked out for these</h2>
            <span className="small muted">Bookings this week with no vehicle</span>
          </div>
          <div className="card-body">
            <ul className="stack-list">
              {uncovered.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`}>
                    {e.partner_two_name
                      ? `${e.partner_one_name} & ${e.partner_two_name}`
                      : e.partner_one_name}
                  </Link>{" "}
                  <span className="muted">
                    — {formatDate(e.event_date)}
                    {e.venue_name ? ` · ${e.venue_name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Send a vehicle out</h2>
        </div>
        <RunForm
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          events={soon.map((e) => ({
            id: e.id,
            label: `${couple(e)} — ${formatDate(e.event_date)}`,
            event_date: e.event_date,
          }))}
          drivers={listDjs().map((d) => ({ id: d.id, name: d.name }))}
          defaultDate={days[0] > today ? days[0] : today}
        />
      </div>
    </>
  );
}
