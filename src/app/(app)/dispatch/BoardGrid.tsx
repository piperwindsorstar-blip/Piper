"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CLASS_SHORT, STATUS_SHORT, type RunStatus } from "@/lib/dispatch-types";
import Icon from "@/components/Icon";
import { removeRun, resizeRun } from "./actions";

/**
 * The board: vehicles down, days across, each run one bar across the days it
 * covers.
 *
 * A CSS grid rather than a table, because a table cell cannot span a run that
 * starts mid-window and a run drawn as one box per day is indistinguishable
 * from several separate bookings. The grid places each bar by column and span,
 * and stacks overlapping ones into lanes.
 *
 * Dragging an edge changes that end's date. The maths is deliberately simple —
 * the grid's own width divided by the number of days gives a column width, and
 * the pointer's travel divided by that gives a whole number of days. Anything
 * cleverer (snapping to the column under the cursor, say) breaks the moment
 * the row scrolls sideways, which on a month view it always does.
 */

export type BoardBar = {
  id: number;
  label: string;
  status: RunStatus;
  column: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  startsOn: string;
  endsOn: string;
  eventId: number | null;
  meetTime: string | null;
  crew: string | null;
  site: string | null;
  keysWith: string | null;
};

export type BoardVehicle = {
  id: number;
  name: string;
  className: keyof typeof CLASS_SHORT;
  pencar: boolean;
  plate: string | null;
  lanes: number;
  bars: BoardBar[];
};

/** Adds days to an ISO date without dragging a date library into the bundle. */
function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type Drag = { barId: number; edge: "start" | "end"; startX: number; days: number };

export default function BoardGrid({
  days,
  vehicles,
  today,
  compact,
}: {
  days: string[];
  vehicles: BoardVehicle[];
  today: string;
  compact: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  function columnWidth(): number {
    const el = gridRef.current;
    if (!el) return 0;
    return el.getBoundingClientRect().width / days.length;
  }

  function onHandleDown(event: React.PointerEvent, bar: BoardBar, edge: "start" | "end") {
    event.preventDefault();
    event.stopPropagation();
    const width = columnWidth();
    const startX = event.clientX;
    if (width <= 0) return;

    (event.target as Element).setPointerCapture(event.pointerId);
    setDrag({ barId: bar.id, edge, startX: event.clientX, days: 0 });

    const move = (e: PointerEvent) => {
      setDrag((current) =>
        current ? { ...current, days: Math.round((e.clientX - current.startX) / width) } : null,
      );
    };

    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);

      const moved = Math.round((e.clientX - startX) / width);
      setDrag(null);
      if (moved === 0) return;

      const startsOn = edge === "start" ? shift(bar.startsOn, moved) : bar.startsOn;
      const endsOn = edge === "end" ? shift(bar.endsOn, moved) : bar.endsOn;
      // A drag that would turn the run inside out is simply not a drag.
      if (endsOn < startsOn) return;

      const form = formRef.current;
      if (!form) return;
      (form.elements.namedItem("id") as HTMLInputElement).value = String(bar.id);
      (form.elements.namedItem("starts_on") as HTMLInputElement).value = startsOn;
      (form.elements.namedItem("ends_on") as HTMLInputElement).value = endsOn;
      form.requestSubmit();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** How far this bar is currently being dragged, for the live preview. */
  function preview(bar: BoardBar): { column: number; span: number } {
    if (!drag || drag.barId !== bar.id || drag.days === 0) {
      return { column: bar.column, span: bar.span };
    }
    if (drag.edge === "start") {
      const column = Math.min(bar.column + drag.days, bar.column + bar.span - 1);
      return { column: Math.max(1, column), span: bar.column + bar.span - Math.max(1, column) };
    }
    const span = Math.max(1, bar.span + drag.days);
    return { column: bar.column, span: Math.min(span, days.length - bar.column + 1) };
  }

  return (
    <>
      {/* One hidden form for every bar: a drag ends by filling it in and
          submitting, which keeps the whole interaction inside a plain server
          action rather than a bespoke endpoint. */}
      <form ref={formRef} action={resizeRun} className="sr-only">
        <input type="hidden" name="id" />
        <input type="hidden" name="starts_on" />
        <input type="hidden" name="ends_on" />
      </form>

      <div className="table-wrap">
        <div className={`board-grid${compact ? " board-grid-compact" : ""}`}>
          <div className="board-grid-head">
            <div className="board-grid-corner">Vehicle</div>
            <div
              className="board-grid-days"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day) => (
                <div key={day} className={`board-grid-day${day === today ? " board-today" : ""}`}>
                  {compact ? Number(day.slice(8)) : day.slice(5).replace("-", "/")}
                </div>
              ))}
            </div>
          </div>

          {vehicles.map((vehicle) => (
            <div className="board-grid-row" key={vehicle.id}>
              <div className="board-grid-name">
                <div>{vehicle.name}</div>
                <div className="small faint">
                  {CLASS_SHORT[vehicle.className]}
                  {vehicle.pencar ? " · Pencar" : ""}
                  {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                </div>
              </div>

              <div
                className="board-grid-track"
                ref={vehicle.id === vehicles[0]?.id ? gridRef : undefined}
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${vehicle.lanes}, auto)`,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day}
                    className={`board-grid-cell${day === today ? " board-today" : ""}`}
                    style={{ gridColumn: `${days.indexOf(day) + 1} / span 1`, gridRow: `1 / -1` }}
                  />
                ))}

                {vehicle.bars.map((bar) => {
                  const at = preview(bar);
                  const dragging = drag?.barId === bar.id;
                  return (
                    <div
                      key={bar.id}
                      className={[
                        "run-bar",
                        `run-${bar.status}`,
                        bar.continuesLeft ? "run-bar-open-left" : "",
                        bar.continuesRight ? "run-bar-open-right" : "",
                        dragging ? "run-bar-dragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        gridColumn: `${at.column} / span ${at.span}`,
                        gridRow: `${bar.lane + 1}`,
                      }}
                      title={`${STATUS_SHORT[bar.status]} — ${bar.label}${
                        bar.startsOn === bar.endsOn ? "" : ` (${bar.startsOn} to ${bar.endsOn})`
                      }`}
                    >
                      {!bar.continuesLeft && (
                        <button
                          type="button"
                          className="run-handle run-handle-start"
                          aria-label={`Change when ${bar.label} goes out`}
                          onPointerDown={(e) => onHandleDown(e, bar, "start")}
                        />
                      )}

                      <div className="run-bar-body">
                        <span className="run-bar-label">
                          {bar.eventId ? (
                            <Link href={`/events/${bar.eventId}`}>{bar.label}</Link>
                          ) : (
                            bar.label
                          )}
                        </span>
                        {!compact && (
                          <span className="run-bar-meta small">
                            {[
                              bar.meetTime ? `Meet ${bar.meetTime}` : null,
                              bar.crew,
                              bar.site,
                              bar.keysWith ? `Keys: ${bar.keysWith}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>

                      <form action={removeRun} className="run-bar-remove">
                        <input type="hidden" name="id" value={bar.id} />
                        <button type="submit" aria-label={`Remove ${bar.label}`}>
                          <Icon name="close" size={12} />
                        </button>
                      </form>

                      {!bar.continuesRight && (
                        <button
                          type="button"
                          className="run-handle run-handle-end"
                          aria-label={`Change when ${bar.label} comes back`}
                          onPointerDown={(e) => onHandleDown(e, bar, "end")}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="small faint board-grid-hint">
        Drag either end of a bar to change its dates. Everything else lives in the form
        below.
      </p>
    </>
  );
}
