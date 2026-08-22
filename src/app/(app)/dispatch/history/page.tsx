import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { peopleWhoDrove, shiftWeek, whoDrove } from "@/lib/dispatch";
import { CLASS_SHORT } from "@/lib/dispatch-types";
import { formatDate, todayIso } from "@/lib/dates";

/**
 * Who drove what, on a date.
 *
 * Asked backwards, always: something happened — a scrape, a fine, a complaint
 * about the parking — and nobody can remember who had the van. So the date is
 * the input and everything else is the answer, and the default is today
 * because that is the day most often asked about.
 *
 * Admin-only, deliberately. The same records tell you where a named person was
 * on a given afternoon, which is office business rather than something the
 * whole roster should be able to browse.
 */
export default async function WhoDrovePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; who?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = todayIso();
  const from = isDate(params.from) ? (params.from as string) : today;
  // A single day by default. A range is there for "sometime last week".
  const to = isDate(params.to) && (params.to as string) >= from ? (params.to as string) : from;
  const who = (params.who ?? "").trim();

  const all = whoDrove(from, to);
  const rows = who
    ? all.filter((r) =>
        [r.driver_name, r.crew].some((f) => f?.toLowerCase().includes(who.toLowerCase())),
      )
    : all;

  const people = peopleWhoDrove();

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Who drove</h2>
          <div className="btn-row">
            <Link className="btn btn-sm" href={`/dispatch/history?from=${shiftWeek(from, -1)}&to=${from}`}>
              Last week
            </Link>
            <Link className="btn btn-sm" href="/dispatch/history">
              Today
            </Link>
          </div>
        </div>

        <form className="card-body" method="get">
          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="from">From</label>
              <input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" name="to" type="date" defaultValue={to} />
              <div className="small faint">Leave the same for a single day</div>
            </div>
            <div className="field">
              <label htmlFor="who">Person</label>
              <input
                id="who"
                name="who"
                type="text"
                defaultValue={who}
                list="drove-names"
                placeholder="Anyone"
              />
              <datalist id="drove-names">
                {people.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">
            Look it up
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            {from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`}
          </h2>
          <span className="small muted">
            {rows.length} {rows.length === 1 ? "trip" : "trips"}
            {who ? ` · ${who}` : ""}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            {who
              ? `Nothing recorded for ${who} in that window.`
              : "Nothing went out in that window."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Out for</th>
                  <th>Driver</th>
                  <th>Crew</th>
                  <th>Keys</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((run) => (
                  <tr key={run.id}>
                    <td className="nowrap">
                      {run.starts_on === run.ends_on
                        ? formatDate(run.starts_on)
                        : `${formatDate(run.starts_on)} – ${formatDate(run.ends_on)}`}
                    </td>
                    <td>
                      {run.vehicle_name}{" "}
                      <span className="faint small">{CLASS_SHORT[run.vehicle_class]}</span>
                    </td>
                    <td>
                      {run.event_id ? (
                        <Link href={`/events/${run.event_id}`}>{run.label}</Link>
                      ) : (
                        run.label
                      )}
                      {run.site && <div className="small faint">{run.site}</div>}
                    </td>
                    <td>{run.driver_name ?? <span className="faint">—</span>}</td>
                    <td>{run.crew ?? <span className="faint">—</span>}</td>
                    <td className="small muted">{run.keys_with ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
