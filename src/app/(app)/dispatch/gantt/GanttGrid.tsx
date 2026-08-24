"use client";

import { useRef, useState, useTransition } from "react";
import { STATUS_LABELS, STATUS_SHORT, type RunStatus } from "@/lib/dispatch-types";
import Icon from "@/components/Icon";
import { cycleCell, removeCell, saveCell, type GanttState } from "./actions";
import { useActionState } from "react";

/**
 * The planning chart, edited straight from the squares.
 *
 * One click cycles a day: empty → needed → booked → empty. That is the order
 * the work actually happens in, and it is the whole interaction most of the
 * time — nobody wants a dialog to say "we'll want a van that Saturday".
 *
 * Right-click opens the dialog for everything else: the other states, a span
 * of days, a note. Long-press does the same on a phone, where there is no
 * right button.
 *
 * Cells are optimistic. A click that waited for the server before colouring in
 * would make filling a month feel like wading, so the square changes at once
 * and the transition reconciles it.
 */

export type GanttBar = {
  id: number;
  state: Exclude<RunStatus, "shop">;
  column: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

export type GanttVehicle = {
  id: number;
  name: string;
  subtitle: string;
  lanes: number;
  bars: GanttBar[];
};

const CYCLE_STATES = ["needed", "booked"] as const;

export default function GanttGrid({
  days,
  vehicles,
  today,
  compact,
}: {
  days: string[];
  vehicles: GanttVehicle[];
  today: string;
  compact: boolean;
}) {
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{
    vehicleId: number;
    vehicleName: string;
    bar: GanttBar | null;
    date: string;
  } | null>(null);

  // What a square has been clicked to, before the server has caught up.
  const [optimistic, setOptimistic] = useState<Record<string, string | null>>({});
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stateOn(vehicle: GanttVehicle, day: string): string | null {
    const key = `${vehicle.id}|${day}`;
    if (key in optimistic) return optimistic[key];
    const bar = vehicle.bars.find((b) => b.startsOn <= day && b.endsOn >= day);
    return bar ? bar.state : null;
  }

  function onCycle(vehicle: GanttVehicle, day: string) {
    const current = stateOn(vehicle, day);
    const next =
      current === null
        ? CYCLE_STATES[0]
        : current === CYCLE_STATES[0]
          ? CYCLE_STATES[1]
          : null;

    setOptimistic((o) => ({ ...o, [`${vehicle.id}|${day}`]: next }));

    const form = new FormData();
    form.set("vehicle_id", String(vehicle.id));
    form.set("date", day);
    startTransition(async () => {
      await cycleCell(form);
      // Let the server's answer take over again once it has re-rendered.
      setOptimistic((o) => {
        const next = { ...o };
        delete next[`${vehicle.id}|${day}`];
        return next;
      });
    });
  }

  function openDialog(vehicle: GanttVehicle, day: string) {
    const bar = vehicle.bars.find((b) => b.startsOn <= day && b.endsOn >= day) ?? null;
    setDialog({ vehicleId: vehicle.id, vehicleName: vehicle.name, bar, date: day });
  }

  return (
    <>
      <div className="table-wrap">
        <div className={`board-grid gantt-grid${compact ? " board-grid-compact" : ""}`}>
          <div className="board-grid-head">
            <div className="board-grid-corner">Vehicle</div>
            <div
              className="board-grid-days"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day) => (
                <div key={day} className={`board-grid-day${day === today ? " board-today" : ""}`}>
                  {/* On a quarter the month has to appear somewhere, so it
                      rides on the first of each. */}
                  {day.endsWith("-01") ? day.slice(5, 7) + "/" : ""}
                  {Number(day.slice(8))}
                </div>
              ))}
            </div>
          </div>

          {vehicles.map((vehicle) => (
            <div className="board-grid-row" key={vehicle.id}>
              <div className="board-grid-name">
                <div>{vehicle.name}</div>
                <div className="small faint">{vehicle.subtitle}</div>
              </div>

              <div
                className="gantt-track"
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {days.map((day) => {
                  const state = stateOn(vehicle, day);
                  const bar = vehicle.bars.find((b) => b.startsOn <= day && b.endsOn >= day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={[
                        "gantt-cell",
                        state ? `run-${state}` : "",
                        day === today ? "board-today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        state
                          ? `${STATUS_SHORT[state as RunStatus]}${bar?.note ? ` — ${bar.note}` : ""} · right-click to edit`
                          : `${day} · click to plan, right-click for options`
                      }
                      aria-label={`${vehicle.name} on ${day}: ${
                        state ? STATUS_LABELS[state as RunStatus] : "nothing planned"
                      }`}
                      onClick={() => onCycle(vehicle, day)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openDialog(vehicle, day);
                      }}
                      // No right button on a phone, so a long press opens it.
                      onPointerDown={() => {
                        pressTimer.current = setTimeout(() => openDialog(vehicle, day), 550);
                      }}
                      onPointerUp={() => {
                        if (pressTimer.current) clearTimeout(pressTimer.current);
                      }}
                      onPointerLeave={() => {
                        if (pressTimer.current) clearTimeout(pressTimer.current);
                      }}
                    >
                      {bar?.note && !compact && bar.startsOn === day && (
                        <span className="gantt-note">{bar.note}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="small faint board-grid-hint">
        Click a square to cycle it: nothing → needed → booked → nothing. Right-click (or
        press and hold) for spans, notes and the other states.
      </p>

      {dialog && (
        <CellDialog
          key={`${dialog.vehicleId}-${dialog.date}-${dialog.bar?.id ?? "new"}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function CellDialog({
  dialog,
  onClose,
}: {
  dialog: { vehicleId: number; vehicleName: string; bar: GanttBar | null; date: string };
  onClose: () => void;
}) {
  const [state, save, saving] = useActionState<GanttState, FormData>(saveCell, {});
  const { bar } = dialog;

  // The action has no way to close a dialog it does not know about, so the
  // success message is the signal.
  if (state.ok) {
    setTimeout(onClose, 0);
  }

  return (
    <div className="gantt-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="card gantt-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Plan for ${dialog.vehicleName}`}
      >
        <div className="card-head">
          <h2>{dialog.vehicleName}</h2>
          <button className="btn btn-sm" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>

        <form action={save} className="card-body">
          {state.error && <div className="alert alert-error">{state.error}</div>}

          <input type="hidden" name="vehicle_id" value={dialog.vehicleId} />
          {bar && <input type="hidden" name="id" value={bar.id} />}

          <div className="field">
            <label htmlFor="state">The day is</label>
            <select id="state" name="state" defaultValue={bar?.state ?? "needed"}>
              {(["needed", "booked", "own", "pynx", "idle"] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid cols-2">
            <div className="field">
              <label htmlFor="starts_on">From</label>
              <input
                id="starts_on"
                name="starts_on"
                type="date"
                defaultValue={bar?.startsOn ?? dialog.date}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ends_on">To</label>
              <input
                id="ends_on"
                name="ends_on"
                type="date"
                defaultValue={bar?.endsOn ?? dialog.date}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="note">Note</label>
            <input
              id="note"
              name="note"
              type="text"
              defaultValue={bar?.note ?? ""}
              placeholder="Three shows that weekend"
            />
          </div>

          <div className="btn-row">
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {bar && (
              <button
                className="btn btn-sm btn-danger"
                type="submit"
                formAction={removeCell}
                formNoValidate
              >
                Remove
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
