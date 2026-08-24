import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listVehicles, monthDays, shiftMonth } from "@/lib/dispatch";
import { CLASS_SHORT, OWNERSHIP_LABELS } from "@/lib/dispatch-types";
import { ganttRows, quarterDays } from "@/lib/gantt";
import { monthLabel, parseIso, todayIso } from "@/lib/dates";
import Icon from "@/components/Icon";
import GanttGrid from "./GanttGrid";

/**
 * The planning chart.
 *
 * Separate from the weekly board on purpose, and worth saying why on the page
 * itself: this is what the shop expects to need, not what is arranged. Nothing
 * here books a vehicle and nothing booked appears here.
 */
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; span?: string }>;
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

  const anchorDate = parseIso(anchor);
  const heading = quarter
    ? `${monthLabel(anchorDate.getFullYear(), anchorDate.getMonth())} — three months`
    : monthLabel(anchorDate.getFullYear(), anchorDate.getMonth());

  const step = (n: number) => shiftMonth(anchor, quarter ? n * 3 : n);
  const href = (at: string) => `/dispatch/gantt?at=${at}${quarter ? "&span=quarter" : ""}`;

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
                  show: b.cell.show_name,
                  note: b.cell.note,
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
      </div>
    </>
  );
}
