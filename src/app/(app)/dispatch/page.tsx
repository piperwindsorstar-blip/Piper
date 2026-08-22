import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { listDjs } from "@/lib/team";
import {
  listVehicles,
  monthDays,
  needed,
  OWNERSHIP_LABELS,
  rentalsDue,
  shiftMonth,
  shiftWeek,
  STATUS_SHORT,
  uncoveredEvents,
  weekBoard,
  weekDays,
} from "@/lib/dispatch";
import { formatDate, formatDateShort, monthLabel, parseIso, todayIso } from "@/lib/dates";
import RunForm from "./RunForm";
import { removeRun } from "./actions";
import Icon from "@/components/Icon";

/**
 * The fleet against the calendar.
 *
 * Two things decide the shape of this page.
 *
 * A run occupies every day it spans, not only the day it starts. A van out
 * Friday to Sunday fills all three cells, because the question being asked is
 * "is that free on Saturday" and a run drawn only on its start date answers it
 * wrongly.
 *
 * And the month is the default, not the week. Hires get arranged weeks ahead,
 * and the thing worth seeing early is a day somebody has flagged as needing a
 * vehicle that nobody has booked — a week's view finds that out on the Friday.
 */
export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const admin = await requireAdmin();
  const { week, view } = await searchParams;

  const today = todayIso();
  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const monthly = view !== "week";

  const days = monthly ? monthDays(anchor) : weekDays(anchor);
  const vehicles = listVehicles();
  const board = weekBoard(days, vehicles);

  const from = days[0];
  const to = days[days.length - 1];
  const gaps = needed(from, to);
  const uncovered = uncoveredEvents(from, to);
  const due = rentalsDue(today);

  const step = (n: number) => (monthly ? shiftMonth(anchor, n) : shiftWeek(anchor, n));
  const href = (at: string) => `/dispatch?week=${at}${monthly ? "" : "&view=week"}`;

  const anchorDate = parseIso(anchor);
  const heading = monthly
    ? monthLabel(anchorDate.getFullYear(), anchorDate.getMonth())
    : `${formatDate(from)} – ${formatDate(to)}`;

  // Bookings worth offering in the picker: this window and a little past it, so
  // the list stays short enough to scan.
  const soon = listEvents(admin, {}).filter(
    (e) => e.event_date >= from && e.event_date <= shiftWeek(to, 6),
  );

  const couple = (e: (typeof soon)[number]) =>
    e.partner_two_name ? `${e.partner_one_name} & ${e.partner_two_name}` : e.partner_one_name;

  return (
    <>
      {gaps.length > 0 && (
        <div className="alert alert-warn">
          <strong>Needed, not booked:</strong>{" "}
          {gaps.map((g) => `${g.vehicle_name} on ${formatDateShort(g.starts_on)}`).join(", ")}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>{heading}</h2>
          <div className="btn-row">
            <Link className="btn btn-sm" href={href(step(-1))}>
              <Icon name="left" size={15} />
              Previous
            </Link>
            <Link className="btn btn-sm" href={monthly ? "/dispatch" : "/dispatch?view=week"}>
              {monthly ? "This month" : "This week"}
            </Link>
            <Link className="btn btn-sm" href={href(step(1))}>
              Next
              <Icon name="right" size={15} />
            </Link>
            <Link
              className="btn btn-sm"
              href={monthly ? `/dispatch?week=${anchor}&view=week` : `/dispatch?week=${anchor}`}
            >
              {monthly ? "Week view" : "Month view"}
            </Link>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="empty">
            No vehicles yet. <Link href="/dispatch/vehicles">Add the fleet</Link> and the
            calendar fills in.
          </div>
        ) : (
          <div className="table-wrap">
            <table className={`table board${monthly ? " board-month" : ""}`}>
              <thead>
                <tr>
                  <th className="board-vehicle">Vehicle</th>
                  {days.map((day) => (
                    <th key={day} className={day === today ? "board-today" : undefined}>
                      {monthly ? parseIso(day).getDate() : formatDateShort(day)}
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
                        {OWNERSHIP_LABELS[vehicle.ownership]}
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
                              className={`run-chip run-${run.status}`}
                              title={`${STATUS_SHORT[run.status]} — ${run.label}`}
                            >
                              {monthly ? (
                                // A month is thirty-one columns wide. There is
                                // room for a colour and nothing else, so the
                                // detail lives in the title and the week view.
                                <span className="sr-only">
                                  {STATUS_SHORT[run.status]}: {run.label}
                                </span>
                              ) : (
                                <>
                                  <div className="run-label">
                                    {run.event_id ? (
                                      <Link href={`/events/${run.event_id}`}>{run.label}</Link>
                                    ) : (
                                      run.label
                                    )}
                                  </div>
                                  {run.meet_time && (
                                    <div className="small faint">Meet {run.meet_time}</div>
                                  )}
                                  {(run.crew || run.driver_name) && (
                                    <div className="small faint">{run.crew ?? run.driver_name}</div>
                                  )}
                                  {run.site && <div className="small faint">{run.site}</div>}
                                  {run.keys_with && (
                                    <div className="small faint">Keys: {run.keys_with}</div>
                                  )}
                                </>
                              )}
                              {/* Only on the first day it covers, or a
                                  three-day run would offer three identical
                                  remove buttons. */}
                              {run.starts_on === day && (
                                <form action={removeRun}>
                                  <input type="hidden" name="id" value={run.id} />
                                  <button
                                    className="run-remove"
                                    type="submit"
                                    aria-label={`Remove ${run.label}`}
                                  >
                                    <Icon name="close" size={13} />
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

        <div className="card-body board-key">
          {(["booked", "needed", "own", "pynx", "idle", "shop"] as const).map((s) => (
            <span key={s} className="board-key-item">
              <span className={`run-swatch run-${s}`} />
              {STATUS_SHORT[s]}
            </span>
          ))}
        </div>
      </div>

      {due.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Hires due back</h2>
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
            <span className="small muted">Bookings in view with no vehicle</span>
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
          <h2>Mark a day</h2>
          <span className="small muted">Book a vehicle, or flag one you need</span>
        </div>
        <RunForm
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          events={soon.map((e) => ({
            id: e.id,
            label: `${couple(e)} — ${formatDate(e.event_date)}`,
            event_date: e.event_date,
          }))}
          drivers={listDjs().map((d) => ({ id: d.id, name: d.name }))}
          defaultDate={from > today ? from : today}
        />
      </div>
    </>
  );
}
