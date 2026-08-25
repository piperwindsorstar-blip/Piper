import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { monthDays, shiftMonth } from "@/lib/dispatch";
import { listSuppliers, overdueRentals, rentalRows } from "@/lib/rentals";
import { quarterDays } from "@/lib/gantt";
import { RENTAL_LABELS, RENTAL_STATES, isOverdue } from "@/lib/rentals-types";
import { formatDate, monthLabel, parseIso, todayIso } from "@/lib/dates";
import Icon from "@/components/Icon";
import RentalGrid from "./RentalGrid";
import SupplierForm from "./SupplierForm";
import { markReturned, toggleSupplier } from "./actions";

/**
 * Gear hired in, drawn the way the plan is.
 *
 * The fleet answers what Pynx sends out; this answers what is coming the other
 * way and whose it is. Same chart, same colours, same click — the row is the
 * place rather than the vehicle, because the places are what stay the same.
 */
export default async function RentalsPage({
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
  const suppliers = listSuppliers();
  const retired = listSuppliers(true).filter((s) => !s.active);
  const rows = rentalRows(days, suppliers);
  const overdue = overdueRentals(today);

  const anchorDate = parseIso(anchor);
  const heading = quarter
    ? `${monthLabel(anchorDate.getFullYear(), anchorDate.getMonth())} — three months`
    : monthLabel(anchorDate.getFullYear(), anchorDate.getMonth());

  const step = (n: number) => shiftMonth(anchor, quarter ? n * 3 : n);
  const href = (at: string) => `/rentals?at=${at}${quarter ? "&span=quarter" : ""}`;

  return (
    <>
      <div className="alert alert-info">
        <strong>Gear coming in, not going out.</strong> What Pynx has hired and who
        from. The <Link href="/dispatch">board</Link> is for the fleet.
      </div>

      {overdue.length > 0 && (
        <div className="alert alert-warn">
          <strong>
            {overdue.length} {overdue.length === 1 ? "hire is" : "hires are"} past due back.
          </strong>
          <ul className="stack-list" style={{ marginTop: "0.5rem" }}>
            {overdue.map((r) => (
              <li key={r.id} className="row-between">
                <span>
                  {r.item} <span className="faint small">from {r.supplier_name}</span>{" "}
                  <span className="faint small">· due {formatDate(r.ends_on)}</span>
                </span>
                <form action={markReturned}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-sm" type="submit">
                    Back with them
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              href={quarter ? "/rentals?span=quarter" : "/rentals"}
            >
              Now
            </Link>
            <Link className="btn btn-sm" href={href(step(1))}>
              On
              <Icon name="right" size={15} />
            </Link>
            <Link
              className="btn btn-sm"
              href={
                quarter ? `/rentals?at=${anchor}` : `/rentals?at=${anchor}&span=quarter`
              }
            >
              {quarter ? "One month" : "Three months"}
            </Link>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="empty">
            No places yet. Add the first one below and its row appears on the chart.
          </div>
        ) : (
          <RentalGrid
            days={days}
            today={today}
            compact={quarter}
            suppliers={rows.map(({ supplier, tracks }) => ({
              id: supplier.id,
              name: supplier.name,
              subtitle: [supplier.contact, supplier.phone].filter(Boolean).join(" · "),
              tracks: tracks.map(({ lane, bars }) => ({
                lane,
                bars: bars.map((b) => ({
                  id: b.item.id,
                  item: b.item.item,
                  quantity: b.item.quantity,
                  state: b.item.state,
                  column: b.column,
                  span: b.span,
                  startsOn: b.item.starts_on,
                  endsOn: b.item.ends_on,
                  job: b.item.job,
                  reference: b.item.reference,
                  cost: b.item.cost,
                  notes: b.item.notes,
                  overdue: isOverdue(b.item.state, b.item.ends_on, today),
                })),
              })),
            }))}
          />
        )}

        <div className="card-body board-key">
          {RENTAL_STATES.map((s) => (
            <span key={s} className="board-key-item">
              <span className={`run-swatch rental-${s}`} />
              {RENTAL_LABELS[s]}
            </span>
          ))}
          <span className="board-key-item">
            <span className="run-swatch rental-overdue" />
            Past due back
          </span>
        </div>
      </div>

      <details className="card">
        <summary className="card-head">
          <h2>The places</h2>
          <span className="badge badge-plain">
            {suppliers.length} {suppliers.length === 1 ? "place" : "places"}
          </span>
        </summary>

        <div className="card-body">
          <p className="small muted">
            A row on the chart for each. Retiring one keeps it on every hire it has already
            supplied — it just stops appearing.
          </p>
        </div>

        <SupplierForm />

        {suppliers.map((supplier) => (
          <details className="card-body" key={supplier.id}>
            <summary className="row-between">
              <span>
                <strong>{supplier.name}</strong>{" "}
                <span className="faint small">
                  {[supplier.contact, supplier.phone].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="badge badge-plain">Edit</span>
            </summary>

            <SupplierForm
              supplier={{
                id: supplier.id,
                name: supplier.name,
                contact: supplier.contact,
                phone: supplier.phone,
                notes: supplier.notes,
              }}
            />

            <form action={toggleSupplier}>
              <input type="hidden" name="id" value={supplier.id} />
              <input type="hidden" name="activate" value="0" />
              <button className="btn btn-sm btn-danger" type="submit">
                Retire
              </button>
            </form>
          </details>
        ))}

        {retired.length > 0 && (
          <div className="card-body">
            <h3 className="small muted">Retired</h3>
            <ul className="stack-list">
              {retired.map((supplier) => (
                <li key={supplier.id} className="row-between">
                  <span>{supplier.name}</span>
                  <form action={toggleSupplier}>
                    <input type="hidden" name="id" value={supplier.id} />
                    <input type="hidden" name="activate" value="1" />
                    <button className="btn btn-sm" type="submit">
                      Put it back
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </>
  );
}
