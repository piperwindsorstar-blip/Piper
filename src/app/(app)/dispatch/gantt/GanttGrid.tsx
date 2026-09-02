"use client";

import { monthBands, monthHue, weekdayLetter } from "@/lib/dates";
import { useRef, useState, useTransition, type CSSProperties } from "react";
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
  show: string | null;
  note: string | null;
};

export type GanttSlotRow = { slot: number; bars: GanttBar[] };

export type GanttVehicle = {
  id: number;
  name: string;
  subtitle: string;
  /** Always rendered, empty or not — the rows are a fixture. */
  slots: GanttSlotRow[];
};

const CYCLE_STATES = ["needed", "booked"] as const;

export default function GanttGrid({
  days,
  vehicles,
  today,
  compact,
  canEdit,
}: {
  days: string[];
  vehicles: GanttVehicle[];
  today: string;
  compact: boolean;
  /** Read-only viewers get the chart without the clicks. The actions refuse
 * them anyway; this stops the refusal being a surprise. */
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{
    vehicleId: number;
    vehicleName: string;
    slot: number;
    bar: GanttBar | null;
    date: string;
  } | null>(null);

  // What a square has been clicked to, before the server has caught up.
  const [optimistic, setOptimistic] = useState<Record<string, string | null>>({});
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = (vehicleId: number, slot: number, day: string) => `${vehicleId}|${slot}|${day}`;

  function barIn(row: GanttSlotRow, day: string): GanttBar | undefined {
    return row.bars.find((b) => b.startsOn <= day && b.endsOn >= day);
  }

  function stateOn(vehicle: GanttVehicle, row: GanttSlotRow, day: string): string | null {
    const k = key(vehicle.id, row.slot, day);
    if (k in optimistic) return optimistic[k];
    const bar = barIn(row, day);
    return bar ? bar.state : null;
  }

  function onCycle(vehicle: GanttVehicle, row: GanttSlotRow, day: string) {
    if (!canEdit) return;
    const current = stateOn(vehicle, row, day);
    const next =
      current === null
        ? CYCLE_STATES[0]
        : current === CYCLE_STATES[0]
          ? CYCLE_STATES[1]
          : null;

    const k = key(vehicle.id, row.slot, day);
    setOptimistic((o) => ({ ...o, [k]: next }));

    const form = new FormData();
    form.set("vehicle_id", String(vehicle.id));
    form.set("slot", String(row.slot));
    form.set("date", day);
    startTransition(async () => {
      await cycleCell(form);
      // Let the server's answer take over again once it has re-rendered.
      setOptimistic((o) => {
        const rest = { ...o };
        delete rest[k];
        return rest;
      });
    });
  }

  function openDialog(vehicle: GanttVehicle, row: GanttSlotRow, day: string) {
    if (!canEdit) return;
    setDialog({
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      slot: row.slot,
      bar: barIn(row, day) ?? null,
      date: day,
    });
  }

  return (
    <>
      <div className="table-wrap">
        <div className={`board-grid gantt-grid${compact ? " board-grid-compact" : ""}`}>
          {/* The months above the dates, each band laid across its own columns.
              Only a quarter shows more than one, but the name is worth having
              on a single month too — the numbers alone never say which. */}
          <div className="board-grid-head board-grid-monthrow">
            <div className="board-grid-corner" />
            <div
              className="board-grid-days"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(var(--day-min), 1fr))` }}
            >
              {monthBands(days).map((band) => (
                <div
                  key={band.key}
                  className="board-grid-month"
                  style={
                    {
                      gridColumn: `${band.start} / span ${band.span}`,
                      "--month-hue": band.hue,
                    } as CSSProperties
                  }
                >
                  {band.label}
                </div>
              ))}
            </div>
          </div>

          <div className="board-grid-head">
            <div className="board-grid-corner">Vehicle</div>
            <div
              className="board-grid-days"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(var(--day-min), 1fr))` }}
            >
              {days.map((day) => (
                <div
                  key={day}
                  className={`board-grid-day${day === today ? " board-today" : ""}`}
                  style={{ "--month-hue": monthHue(day) } as CSSProperties}
                >
                  <span className="board-grid-dow">{weekdayLetter(day)}</span>
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
                {vehicle.slots.length > 1 && (
                  <div className="small faint">{vehicle.slots.length} at once</div>
                )}
              </div>

              <div className="gantt-slots">
                {vehicle.slots.map((row) => (
                  <div
                    key={row.slot}
                    className="gantt-track"
                    style={{ gridTemplateColumns: `repeat(${days.length}, minmax(var(--day-min), 1fr))` }}
                  >
                    {days.map((day) => {
                      const state = stateOn(vehicle, row, day);
                      const bar = barIn(row, day);
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
                              ? [
                                  STATUS_SHORT[state as RunStatus],
                                  bar?.show ? `— ${bar.show}` : "",
                                  bar?.note ? `(${bar.note})` : "",
                                  "· right-click to edit",
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                              : `${day} · click to plan, right-click for options`
                          }
                          aria-label={`${vehicle.name}${
                            vehicle.slots.length > 1 ? ` slot ${row.slot + 1}` : ""
                          } on ${day}: ${
                            state ? STATUS_LABELS[state as RunStatus] : "nothing planned"
                          }`}
                          onClick={() => onCycle(vehicle, row, day)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            openDialog(vehicle, row, day);
                          }}
                          // No right button on a phone, so a long press opens it.
                          onPointerDown={() => {
                            pressTimer.current = setTimeout(
                              () => openDialog(vehicle, row, day),
                              550,
                            );
                          }}
                          onPointerUp={() => {
                            if (pressTimer.current) clearTimeout(pressTimer.current);
                          }}
                          onPointerLeave={() => {
                            if (pressTimer.current) clearTimeout(pressTimer.current);
                          }}
                        >
                          {!compact && bar?.startsOn === day && (bar.show || bar.note) && (
                            <span
                              className="gantt-note"
                              style={{ "--span": bar.span } as CSSProperties}
                            >
                              {bar.show ?? bar.note}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="small faint board-grid-hint">
        {canEdit
          ? "Click a square to cycle it: nothing → needed → booked → nothing. Right-click (or press and hold) for spans, notes and the other states."
          : "Hover a square to see what is planned."}
      </p>

      {dialog && (
        <CellDialog
          key={`${dialog.vehicleId}-${dialog.slot}-${dialog.date}-${dialog.bar?.id ?? "new"}`}
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
  dialog: {
    vehicleId: number;
    vehicleName: string;
    slot: number;
    bar: GanttBar | null;
    date: string;
  };
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
          <input type="hidden" name="slot" value={dialog.slot} />
          {bar && <input type="hidden" name="id" value={bar.id} />}

          {/* The show comes first because it is the thing being typed. Everybody
              opening this dialog knows which day they right-clicked; what they
              have in their head is the name of the show, and asking for it
              after three other questions makes them hold it. It is also what
              the bar ends up saying, and what the recommender quotes back when
              the vehicle turns out to be spoken for — so it has to be its own
              box, separable from "needs the big speakers". */}
          <div className="field">
            <label htmlFor="show_name">Show</label>
            <input
              id="show_name"
              name="show_name"
              type="text"
              defaultValue={bar?.show ?? ""}
              placeholder="Nakamura & Delgado"
              autoComplete="off"
              autoFocus
            />
          </div>

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
