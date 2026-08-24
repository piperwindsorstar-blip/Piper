import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listVehicles, monthDays, shiftMonth } from "@/lib/dispatch";
import { CLASS_LABELS, CLASS_SHORT, OWNERSHIP_LABELS, VEHICLE_CLASSES, isVehicleClass } from "@/lib/dispatch-types";
import { ganttRows, quarterDays, suggestVehicles } from "@/lib/gantt";
import { formatDate, monthLabel, parseIso, todayIso } from "@/lib/dates";
import Icon from "@/components/Icon";
import GanttGrid from "./GanttGrid";
import ClearRow from "./ClearRow";

/**
 * The planning chart.
 *
 * Separate from the weekly board on purpose, and worth saying why on the page
 * itself: this is what the shop expects to need, not what is arranged. Nothing
 * here books a vehicle and nothing booked appears here. They inform each other
 * only through the recommender below, which reads both before answering.
 */
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; span?: string; from?: string; to?: string; want?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const today = todayIso();
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const anchor = isDate(params.at) ? (params.at as string) : today;
  const quarter = params.span === "quarter";

  const days = quarter ? quarterDays(anchor) : monthDays(anchor);
  const vehicles = listVehicles();
  const rows = ganttRows(days, vehicles);

  const from = days[0];
  const to = days[days.length - 1];
  const anchorDate = parseIso(anchor);
  const heading = quarter
    ? `${monthLabel(anchorDate.getFullYear(), anchorDate.getMonth())} — three months`
    : monthLabel(anchorDate.getFullYear(), anchorDate.getMonth());

  const step = (n: number) => shiftMonth(anchor, quarter ? n * 3 : n);
  const href = (at: string) => `/dispatch/gantt?at=${at}${quarter ? "&span=quarter" : ""}`;

  // The recommender, when somebody has asked it something.
  const askFrom = isDate(params.from) ? (params.from as string) : null;
  const askTo = isDate(params.to) && (params.to as string) >= (askFrom ?? "") ? (params.to as string) : askFrom;
  const want = isVehicleClass(params.want) ? params.want : undefined;
  const suggestions = askFrom && askTo ? suggestVehicles(vehicles, askFrom, askTo, want) : [];

  return (
    <>
      <div className="alert alert-info">
        <strong>This is the plan, not the schedule.</strong> Nothing here books a vehicle.
        Use the <Link href="/dispatch">board</Link> when it is actually arranged.
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{heading}</h2>
          <div className="btn-row">
            <Link className="btn btn-sm" href={href(step(-1))}>
              <Icon name="left" size={15} />
              Back
            </Link>
            <Link
              className="btn btn-sm"
              href={quarter ? "/dispatch/gantt?span=quarter" : "/dispatch/gantt"}
            >
              Now
            </Link>
            <Link className="btn btn-sm" href={href(step(1))}>
              On
              <Icon name="right" size={15} />
            </Link>
            <Link
              className="btn btn-sm"
              href={quarter ? `/dispatch/gantt?at=${anchor}` : `/dispatch/gantt?at=${anchor}&span=quarter`}
            >
              {quarter ? "One month" : "Three months"}
            </Link>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="empty">
            No vehicles yet. <Link href="/dispatch/vehicles">Add the fleet</Link> first.
          </div>
        ) : (
          <GanttGrid
            days={days}
            today={today}
            compact={quarter}
            vehicles={rows.map(({ vehicle, slots }) => ({
              id: vehicle.id,
              name: vehicle.name,
              subtitle: `${CLASS_SHORT[vehicle.class]} · ${OWNERSHIP_LABELS[vehicle.ownership]}`,
              slots: slots.map(({ slot, bars }) => ({
                slot,
                bars: bars.map((b) => ({
                  id: b.run.id,
                  state: b.run.status as "booked" | "needed" | "idle" | "own" | "pynx",
                  column: b.column,
                  span: b.span,
                  lane: b.lane,
                  continuesLeft: b.continuesLeft,
                  continuesRight: b.continuesRight,
                  startsOn: b.run.starts_on,
                  endsOn: b.run.ends_on,
                  note: b.run.label || null,
                })),
              })),
            }))}
          />
        )}

        <div className="card-body board-key">
          {(["booked", "needed", "own", "pynx", "idle"] as const).map((s) => (
            <span key={s} className="board-key-item">
              <span className={`run-swatch run-${s}`} />
              {s === "booked"
                ? "Booked"
                : s === "needed"
                  ? "Needed"
                  : s === "own"
                    ? "Own car"
                    : s === "pynx"
                      ? "Pynx Cargo"
                      : "Idle"}
            </span>
          ))}
        </div>

        <ClearRow
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          from={from}
          to={to}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>What could take it?</h2>
          <span className="small muted">Reads the plan and the board</span>
        </div>

        <form className="card-body" method="get">
          {/* The window on screen rides along so asking a question does not
              also throw away the month somebody was looking at. */}
          <input type="hidden" name="at" value={anchor} />
          {quarter && <input type="hidden" name="span" value="quarter" />}

          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="from">From</label>
              <input id="from" name="from" type="date" defaultValue={askFrom ?? today} required />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" name="to" type="date" defaultValue={askTo ?? today} />
            </div>
            <div className="field">
              <label htmlFor="want">Ideally</label>
              <select id="want" name="want" defaultValue={want ?? ""}>
                <option value="">Anything</option>
                {VEHICLE_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">
            Find one
          </button>
        </form>

        {askFrom && askTo && (
          <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="small muted">
              {askFrom === askTo ? formatDate(askFrom) : `${formatDate(askFrom)} – ${formatDate(askTo)}`}
              {want ? ` · looking for a ${CLASS_LABELS[want].toLowerCase()}` : ""}
            </p>

            {suggestions.length === 0 ? (
              <div className="empty">No vehicles on the fleet yet.</div>
            ) : (
              <ul className="stack-list">
                {suggestions.map((s) => (
                  <li key={s.vehicle.id} className="row-between">
                    <span>
                      <strong>{s.vehicle.name}</strong>{" "}
                      <span className="faint small">
                        {CLASS_SHORT[s.vehicle.class]} · {OWNERSHIP_LABELS[s.vehicle.ownership]}
                        {s.vehicle.passenger_capacity ? ` · ${s.vehicle.passenger_capacity} seats` : ""}
                        {s.vehicle.weight_capacity ? ` · ${s.vehicle.weight_capacity}` : ""}
                      </span>
                      {s.conflicts.length > 0 && (
                        <div className="small muted">{s.conflicts.join(" · ")}</div>
                      )}
                    </span>
                    {s.free ? (
                      <span className={`badge ${s.classMatch ? "badge-confirmed" : "badge-plain"}`}>
                        {s.vehicle.slots > 1 ? `${s.spare} of ${s.vehicle.slots} free` : "Free"}
                        {s.classMatch ? " · right kind" : ""}
                      </span>
                    ) : (
                      <span className="badge badge-cancelled">Spoken for</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {want && suggestions.every((s) => !s.free || !s.classMatch) && (
              <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                Nothing of that kind is free — worth phoning Pencar for one, and marking
                the days <em>needed</em> so it does not get forgotten.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
