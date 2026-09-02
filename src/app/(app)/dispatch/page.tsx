import { can } from "@/lib/permissions";
import ReadOnly from "@/components/ReadOnly";
import Link from "next/link";
import { requireArea } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { listDjs } from "@/lib/team";
import {
  boardLanes,
  COMMITTED,
  listVehicles,
  neededCounts,
  monthDays,
  needed,
  OWNERSHIP_LABELS,
  rentalsDue,
  runsOn,
  shiftMonth,
  shiftWeek,
  STATUS_SHORT,
  uncoveredEvents,
  weekDays,
} from "@/lib/dispatch";
import {
  formatDate,
  formatDateShort,
  formatDayTitle,
  monthLabel,
  parseIso,
  todayIso,
} from "@/lib/dates";
import { showsOutTabs } from "@/lib/shows-out";
import RunForm from "./RunForm";
import BoardGrid from "./BoardGrid";
import ShowsOut from "@/components/ShowsOut";
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
  const admin = await requireArea("dispatch", "view");
  const canEdit = can(admin, "dispatch", "edit");
  const { week, view } = await searchParams;

  const today = todayIso();
  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const monthly = view !== "week";

  const days = monthly ? monthDays(anchor) : weekDays(anchor);
  const vehicles = listVehicles();
  const board = boardLanes(days, vehicles);

  const from = days[0];
  const to = days[days.length - 1];
  const gaps = needed(from, to);
  const counts = neededCounts(today);
  const uncovered = uncoveredEvents(from, to);
  const due = rentalsDue(today);

  // Today, whatever month the grid below is showing. The grid answers "is that
  // free on the 19th"; this answers "what is going out in an hour", and the
  // second question does not wait while somebody pages back from November.
  const todayRuns = runsOn(today);
  const outToday = new Set(
    todayRuns.filter((r) => COMMITTED.includes(r.status)).map((r) => r.vehicle_id),
  ).size;

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
      {/* The same shape the crew reads on the public board, so the office and
          the yard are looking at one thing rather than two. */}
      <section className="card today-panel">
        <p className="today-eyebrow">{formatDayTitle(today)}</p>

        <div className="today-stats">
          <Stat label="Vehicles out today" value={outToday} />
          <Stat label="Needed today" value={counts.today} note="flagged, not booked" warn />
          <Stat label="Needed the rest of the week" value={counts.week} note="phoning still to do" warn />
        </div>

        <ShowsOut tabs={showsOutTabs(today)} />
      </section>

      {gaps.length > 0 && (
        <div className="alert alert-warn">
          {/* "In view" rather than a bare "needed": the counters above are
              anchored to today whatever you are browsing, and two unqualified
              "needed" figures next to each other read as a contradiction the
              moment you page forward to September. */}
          <strong>Needed in view, not booked:</strong>{" "}
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
          <BoardGrid
            days={days}
            today={today}
            compact={monthly}
            vehicles={board.map(({ vehicle, bars, lanes }) => ({
              id: vehicle.id,
              name: vehicle.name,
              className: vehicle.class,
              pencar: vehicle.ownership === "pencar",
              plate: vehicle.plate,
              lanes,
              bars: bars.map((b) => ({
                id: b.run.id,
                label: b.run.label,
                status: b.run.status,
                column: b.column,
                span: b.span,
                lane: b.lane,
                continuesLeft: b.continuesLeft,
                continuesRight: b.continuesRight,
                startsOn: b.run.starts_on,
                endsOn: b.run.ends_on,
                eventId: b.run.event_id,
                meetTime: b.run.meet_time,
                crew: b.run.crew,
                site: b.run.site,
                keysWith: b.run.keys_with,
              })),
            }))}
          />
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

      {!canEdit && <ReadOnly what="This board is read-only for you." />}

      {canEdit && (
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
      )}
    </>
  );
}

/**
 * A number with its name over it.
 *
 * `warn` marks the counts that are a gap rather than a fact — a day flagged as
 * needing a vehicle nobody has booked. Those go the colour the board uses for
 * 'needed', and only when there are any: a nought in warning red reads as a
 * problem when it is the absence of one.
 */
function Stat({
  label,
  value,
  note,
  warn = false,
}: {
  label: string;
  value: number;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="today-stat">
      <div className="today-stat-label">{label}</div>
      <div
        className="today-stat-value"
        style={{ color: warn && value > 0 ? "var(--run-needed)" : undefined }}
      >
        {value}
      </div>
      {note && <div className="today-stat-note">{note}</div>}
    </div>
  );
}
