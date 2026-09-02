"use client";

import { weekdayLetter } from "@/lib/dates";
import { useActionState, useRef, useState } from "react";
import { RENTAL_LABELS, RENTAL_SHORT, RENTAL_STATES, type RentalState } from "@/lib/rentals-types";
import Icon from "@/components/Icon";
import { removeRental, saveRental, type RentalsState } from "./actions";

/**
 * Gear hired in, on the same chart as the plan.
 *
 * Deliberately the same shape and the same colours as the Gantt: a row per
 * place, and a block across the days something is held for. Somebody who can
 * read one can read the other without being told.
 *
 * The block is one element, not a run of squares. A five-day hire is one thing
 * that happened — it goes back on one day, for one price, on one line of a
 * quote — so it is one thing to point at and one thing to click, and editing
 * it changes the whole hire rather than a day of it. Days with nothing on them
 * stay separate squares, because those are where a new hire gets started.
 *
 * The one interaction that differs is the click. A square on the plan cycles,
 * because "we'll want a van that Saturday" is the whole thought. A hire is not
 * finished until it says what the item is, so a click opens the dialog with the
 * day and the place already filled in. Right-click and long-press do the same,
 * so the muscle memory carries over either way.
 */

export type RentalBar = {
  id: number;
  item: string;
  quantity: number;
  state: RentalState;
  column: number;
  span: number;
  startsOn: string;
  endsOn: string;
  job: string | null;
  reference: string | null;
  cost: string | null;
  notes: string | null;
  overdue: boolean;
};

export type RentalTrackRow = { lane: number; bars: RentalBar[] };

export type RentalSupplier = {
  id: number;
  name: string;
  subtitle: string;
  /** Always at least one, so a place with nothing on hire still has its row. */
  tracks: RentalTrackRow[];
};

type Dialog = {
  supplierId: number;
  supplierName: string;
  bar: RentalBar | null;
  date: string;
};

export default function RentalGrid({
  days,
  suppliers,
  today,
  compact,
  canEdit,
}: {
  days: string[];
  suppliers: RentalSupplier[];
  today: string;
  compact: boolean;
  /** Read-only viewers get the chart without the clicks: a square that opens a
 * dialog whose save bounces is worse than a square that does nothing. */
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function barIn(track: RentalTrackRow, day: string): RentalBar | undefined {
    return track.bars.find((b) => b.startsOn <= day && b.endsOn >= day);
  }

  function open(supplier: RentalSupplier, track: RentalTrackRow, day: string) {
    if (!canEdit) return;
    setDialog({
      supplierId: supplier.id,
      supplierName: supplier.name,
      bar: barIn(track, day) ?? null,
      date: day,
    });
  }

  return (
    <>
      <div className="table-wrap">
        <div className={`board-grid gantt-grid${compact ? " board-grid-compact" : ""}`}>
          <div className="board-grid-head">
            <div className="board-grid-corner">Hired from</div>
            <div
              className="board-grid-days"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day) => (
                <div key={day} className={`board-grid-day${day === today ? " board-today" : ""}`}>
                  <span className="board-grid-dow">{weekdayLetter(day)}</span>
                  {day.endsWith("-01") ? day.slice(5, 7) + "/" : ""}
                  {Number(day.slice(8))}
                </div>
              ))}
            </div>
          </div>

          {suppliers.map((supplier) => (
            <div className="board-grid-row" key={supplier.id}>
              <div className="board-grid-name">
                <div>{supplier.name}</div>
                {supplier.subtitle && <div className="small faint">{supplier.subtitle}</div>}
              </div>

              <div className="gantt-slots">
                {supplier.tracks.map((track) => (
                  <div
                    key={track.lane}
                    className="gantt-track"
                    style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
                  >
                    {/* One element per hire, spanning its days, rather than a
                        square per day. A five-day hire is one thing that
                        happened, so it should be one thing to point at and one
                        thing to click — and joined, the block can carry its own
                        dates without the eye having to count columns. Days with
                        nothing on them stay separate squares, because those are
                        where a new hire gets started. */}
                    {days.map((day, i) => {
                      const bar = barIn(track, day);

                      if (bar) {
                        // Only the first visible day draws; the rest of the
                        // span belongs to that one element.
                        if (bar.startsOn !== day && i !== 0) return null;
                        const from = days.indexOf(bar.startsOn);
                        const column = from === -1 ? 1 : from + 1;
                        const end = days.indexOf(bar.endsOn);
                        const last = end === -1 ? days.length : end + 1;

                        return (
                          <button
                            key={`bar-${bar.id}`}
                            type="button"
                            className={[
                              "gantt-cell",
                              "rental-block",
                              `rental-${bar.state}`,
                              bar.overdue ? "rental-overdue" : "",
                              bar.startsOn < days[0] ? "rental-open-left" : "",
                              bar.endsOn > days[days.length - 1] ? "rental-open-right" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ gridColumn: `${column} / ${last + 1}` }}
                            title={[
                              bar.item,
                              bar.quantity > 1 ? `×${bar.quantity}` : "",
                              `— ${RENTAL_SHORT[bar.state]}`,
                              bar.overdue ? "(overdue)" : "",
                              bar.job ? `· ${bar.job}` : "",
                              "· click to edit the whole hire",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={`${bar.item} from ${supplier.name}, ${bar.startsOn} to ${bar.endsOn}: ${RENTAL_LABELS[bar.state]}`}
                            onClick={() => open(supplier, track, bar.startsOn)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              open(supplier, track, bar.startsOn);
                            }}
                          >
                            {!compact && (
                              <span className="rental-block-label">
                                {bar.quantity > 1 ? `${bar.quantity}× ` : ""}
                                {bar.item}
                              </span>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={day}
                          type="button"
                          className={`gantt-cell${day === today ? " board-today" : ""}`}
                          style={{ gridColumn: `${i + 1} / ${i + 2}` }}
                          title={`${day} · click to add a hire from ${supplier.name}`}
                          aria-label={`${supplier.name} on ${day}: nothing on hire`}
                          onClick={() => open(supplier, track, day)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            open(supplier, track, day);
                          }}
                          onPointerDown={() => {
                            pressTimer.current = setTimeout(() => open(supplier, track, day), 550);
                          }}
                          onPointerUp={() => {
                            if (pressTimer.current) clearTimeout(pressTimer.current);
                          }}
                          onPointerLeave={() => {
                            if (pressTimer.current) clearTimeout(pressTimer.current);
                          }}
                        />
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
          ? "Click a square to put something on hire from that place, or to edit what is already there. Hover a block for the full name."
          : "Hover a block for the full name."}
      </p>

      {dialog && (
        <RentalDialog
          key={`${dialog.supplierId}-${dialog.date}-${dialog.bar?.id ?? "new"}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function RentalDialog({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const [state, save, saving] = useActionState<RentalsState, FormData>(saveRental, {});
  const { bar } = dialog;

  // The action cannot close a dialog it does not know about, so success is the
  // signal. Same as the plan's.
  if (state.ok) {
    setTimeout(onClose, 0);
  }

  return (
    <div className="gantt-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="card gantt-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Hire from ${dialog.supplierName}`}
      >
        <div className="card-head">
          <h2>{dialog.supplierName}</h2>
          <button className="btn btn-sm" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>

        <form action={save} className="card-body">
          {state.error && <div className="alert alert-error">{state.error}</div>}

          <input type="hidden" name="supplier_id" value={dialog.supplierId} />
          {bar && <input type="hidden" name="id" value={bar.id} />}

          {/* The item first, for the same reason the plan asks for the show
              first: it is the thing the person already has in their head. */}
          <div className="form-grid cols-2">
            <div className="field">
              <label htmlFor="item">Item *</label>
              <input
                id="item"
                name="item"
                type="text"
                defaultValue={bar?.item ?? ""}
                placeholder="MagicQ MQ50 console"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quantity">How many</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={99}
                defaultValue={bar?.quantity ?? 1}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="state">Where it is up to</label>
            <select id="state" name="state" defaultValue={bar?.state ?? "booked"}>
              {RENTAL_STATES.map((s) => (
                <option key={s} value={s}>
                  {RENTAL_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid cols-2">
            <div className="field">
              <label htmlFor="starts_on">Picked up</label>
              <input
                id="starts_on"
                name="starts_on"
                type="date"
                defaultValue={bar?.startsOn ?? dialog.date}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ends_on">Due back</label>
              <input
                id="ends_on"
                name="ends_on"
                type="date"
                defaultValue={bar?.endsOn ?? dialog.date}
              />
            </div>
          </div>

          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="job">For</label>
              <input
                id="job"
                name="job"
                type="text"
                defaultValue={bar?.job ?? ""}
                placeholder="26-0664"
              />
            </div>
            <div className="field">
              <label htmlFor="reference">Their reference</label>
              <input
                id="reference"
                name="reference"
                type="text"
                defaultValue={bar?.reference ?? ""}
                placeholder="Quote or WO number"
              />
            </div>
            <div className="field">
              <label htmlFor="cost">Cost</label>
              <input
                id="cost"
                name="cost"
                type="text"
                defaultValue={bar?.cost ?? ""}
                placeholder="460, or 95/day"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Note</label>
            <input
              id="notes"
              name="notes"
              type="text"
              defaultValue={bar?.notes ?? ""}
              placeholder="Comes without a case"
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
                formAction={removeRental}
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
